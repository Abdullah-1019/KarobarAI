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

import { prisma } from '../../src/core/prisma';
import { buildBuyerContext } from '../../src/modules/chatbot/buyer-context-builder.service';
import { runScopedAgentLoop } from '../../src/modules/chatbot/scoped-agent.service';
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
