jest.mock('../../src/core/prisma', () => ({
  prisma: {
    chatSession: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    chatMessage: { create: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('../../src/modules/chatbot/buyer-context-builder.service', () => ({
  buildBuyerContext: jest.fn(),
  getPublicStorefront: jest.fn(),
  getStoreForLiveProduct: jest.fn(),
}));
jest.mock('../../src/modules/chatbot/scoped-agent.service', () => ({ runScopedAgentLoop: jest.fn() }));
jest.mock('../../src/modules/chatbot/buyer-tool-executor.service', () => ({
  ...jest.requireActual('../../src/modules/chatbot/buyer-tool-executor.service'),
  executeBuyerTool: jest.fn(),
}));
jest.mock('../../src/modules/chatbot/buyer-catalog-lookup.service', () => ({
  ...jest.requireActual('../../src/modules/chatbot/buyer-catalog-lookup.service'),
  getCatalogReply: jest.fn(),
  resolveCartRequest: jest.fn(),
}));

import { prisma } from '../../src/core/prisma';
import { buildBuyerContext } from '../../src/modules/chatbot/buyer-context-builder.service';
import { runScopedAgentLoop } from '../../src/modules/chatbot/scoped-agent.service';
import { getCatalogReply, resolveCartRequest } from '../../src/modules/chatbot/buyer-catalog-lookup.service';
import { executeBuyerTool } from '../../src/modules/chatbot/buyer-tool-executor.service';
import { getBuyerConversation, sendBuyerMessage } from '../../src/modules/chatbot/buyer-chat.service';

const context = {
  storeId: 41n,
  store: { slug: 'sample-store-seller-id', publicId: 'seller-public-id', name: 'Sample Store', policies: {} },
  cart: null,
};

describe('buyer chat service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(buildBuyerContext).mockResolvedValue(context as never);
    jest.mocked(prisma.chatMessage.findMany).mockResolvedValue([] as never);
    jest.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);
    jest.mocked(prisma.chatSession.create).mockResolvedValue({ id: 'session12345' } as never);
    jest.mocked(getCatalogReply).mockResolvedValue(null);
    jest.mocked(resolveCartRequest).mockResolvedValue(null);
    jest.mocked(runScopedAgentLoop).mockResolvedValue({ finalReply: 'Grounded response', steps: [] });
  });

  it('creates a fixed-store guest session, applies scope guard, and persists the exchange', async () => {
    const result = await sendBuyerMessage('sample-store-seller-id', {
      message: 'Do you have cotton shirts?', locale: 'en',
    });

    expect(prisma.chatSession.create).toHaveBeenCalledWith({
      data: { context: 'BUYER_STORE', storeId: 41n, buyerUserId: null },
      select: { id: true },
    });
    expect(runScopedAgentLoop).toHaveBeenCalledWith(expect.objectContaining({
      maxSteps: 4,
      tools: expect.arrayContaining([expect.objectContaining({ name: 'redirect_checkout' })]),
    }), expect.objectContaining({
      similarityThreshold: 0.5,
      exemplarQuestions: expect.arrayContaining(['do you have this in blue', 'کیا یہ نیلے رنگ میں موجود ہے']),
      refusalMessage: expect.objectContaining({ en: expect.any(String), ur: expect.any(String) }),
    }), 'en');
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ sessionId: 'session12345', reply: 'Grounded response', redirectToCheckout: false });
  });

  it('does not reuse a session under a different store slug', async () => {
    jest.mocked(prisma.chatSession.findFirst).mockResolvedValue(null);

    await expect(sendBuyerMessage('other-store-seller-id', {
      message: 'Hello', sessionId: 'session12345', locale: 'en',
    })).rejects.toMatchObject({ code: 'CHAT_SESSION_NOT_FOUND', statusCode: 404 });
    expect(runScopedAgentLoop).not.toHaveBeenCalled();
  });

  it.each(['hair clips', 'Hair clips', 'and hair clip', 'wallet'])(
    'answers the bare or follow-up catalog request %s from this store only', async (message) => {
      jest.mocked(getCatalogReply).mockResolvedValue('Hair Clips - 6 Pack — Rs. 350 (12 in stock).');
      const result = await sendBuyerMessage('sample-store-seller-id', { message, locale: 'en' });
      expect(result.reply).toContain('Hair Clips - 6 Pack');
      expect(result.reply).toContain('12 in stock');
      expect(getCatalogReply).toHaveBeenCalledWith(41n, message, 'en');
      expect(runScopedAgentLoop).not.toHaveBeenCalled();
    },
  );

  it('does not claim a cart mutation after the tool rejected malformed arguments', async () => {
    jest.mocked(runScopedAgentLoop).mockResolvedValue({
      finalReply: 'The item has been added to your cart.',
      steps: [{ toolCall: { type: 'add_to_cart', payload: { productId: 'Cotton Socks' } }, toolResult: { ok: false, error: 'Invalid cart request.' } }],
    });
    const result = await sendBuyerMessage('sample-store-seller-id', { message: 'add socks to cart', locale: 'en' });
    expect(result.reply).toContain('Invalid cart request.');
    expect(result.reply).toContain('No item was added');
    expect(result.redirectToCheckout).toBe(false);
  });

  it('uses the validated store product ID for an explicit cart request and confirms only the tool outcome', async () => {
    jest.mocked(resolveCartRequest).mockResolvedValue({
      kind: 'product', productId: '11111111-1111-4111-8111-111111111111', titleEn: 'White Sugar - 1 kg', quantity: 1,
    });
    jest.mocked(executeBuyerTool).mockResolvedValue({ ok: true, quantityAdded: 1 });
    const result = await sendBuyerMessage('sample-store-seller-id', { message: 'add 1 white sugar to cart', locale: 'en' });
    expect(executeBuyerTool).toHaveBeenCalledWith(context, undefined, {
      type: 'add_to_cart', payload: { productId: '11111111-1111-4111-8111-111111111111', quantity: 1, variantAttributes: {} },
    });
    expect(result.reply).toContain('Added 1 × White Sugar - 1 kg');
    expect(result.reply).toContain('No order has been placed');
    expect(result.redirectToCheckout).toBe(false);
    expect(runScopedAgentLoop).not.toHaveBeenCalled();
  });

  it('keeps a purchase inquiry read-only until the buyer explicitly requests a cart update', async () => {
    jest.mocked(getCatalogReply).mockResolvedValue('White Sugar - 1 kg — Rs. 210 (15 in stock). No item was added to your cart.');
    const result = await sendBuyerMessage('sample-store-seller-id', { message: 'i want to buy sugar', locale: 'en' });
    expect(result.reply).toContain('White Sugar - 1 kg');
    expect(executeBuyerTool).not.toHaveBeenCalled();
    expect(runScopedAgentLoop).not.toHaveBeenCalled();
  });

  it('never treats a chat order request as a completed order', async () => {
    const result = await sendBuyerMessage('sample-store-seller-id', {
      message: 'place the order of cotton socks quantity 1', locale: 'en',
    });
    expect(result.reply).toContain('No order has been placed');
    expect(runScopedAgentLoop).not.toHaveBeenCalled();
    expect(result.redirectToCheckout).toBe(false);
  });

  it('returns redirect intent only as a frontend navigation signal', async () => {
    jest.mocked(runScopedAgentLoop).mockResolvedValue({
      finalReply: 'Your cart is ready.',
      steps: [{ toolCall: { type: 'redirect_checkout', payload: {} }, toolResult: { signal: 'redirect_checkout' } }],
    });
    const result = await sendBuyerMessage('sample-store-seller-id', { message: 'Checkout', locale: 'en' });
    expect(result.redirectToCheckout).toBe(true);
    expect(prisma.chatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: 'ASSISTANT', toolCall: { type: 'redirect_checkout', payload: {} } }),
    }));
  });

  it('enforces store and buyer ownership when loading conversation history', async () => {
    jest.mocked(prisma.chatSession.findFirst).mockResolvedValue({ id: 'session12345', buyerUserId: null } as never);
    jest.mocked(prisma.chatMessage.findMany).mockResolvedValue([] as never);
    const history = await getBuyerConversation('sample-store-seller-id', 'session12345');
    expect(prisma.chatSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'session12345', context: 'BUYER_STORE', storeId: 41n },
    }));
    expect(history.sessionId).toBe('session12345');
  });
});
