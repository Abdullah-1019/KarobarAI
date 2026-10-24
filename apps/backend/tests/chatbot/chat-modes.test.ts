jest.mock('../../src/modules/chatbot/product-variant.adapter', () => ({
  ...jest.requireActual('../../src/modules/chatbot/product-variant.adapter'),
  listProductVariants: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../src/core/prisma', () => ({
  prisma: {
    chatSession: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    chatMessage: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  },
}));
jest.mock('../../src/core/redis', () => ({ redis: { set: jest.fn().mockResolvedValue('OK'), eval: jest.fn().mockResolvedValue(1) } }));
jest.mock('../../src/modules/chatbot/buyer-context-builder.service', () => ({
  buildBuyerContext: jest.fn(), getPublicStorefront: jest.fn(), getStoreForLiveProduct: jest.fn(),
}));
jest.mock('../../src/modules/chatbot/agent-loop.service', () => ({ runAgentLoop: jest.fn() }));
jest.mock('../../src/modules/chatbot/scoped-agent.service', () => ({ runScopedAgentLoop: jest.fn() }));
jest.mock('../../src/modules/chatbot/buyer-tool-executor.service', () => ({
  ...jest.requireActual('../../src/modules/chatbot/buyer-tool-executor.service'),
  executeBuyerTool: jest.fn(),
}));
jest.mock('../../src/modules/chatbot/product-search.service', () => ({
  ...jest.requireActual('../../src/modules/chatbot/product-search.service'),
  searchCatalog: jest.fn(), findStoreItems: jest.fn(),
}));
jest.mock('../../src/modules/chatbot/seller-context-builder.service', () => ({ buildSellerContext: jest.fn() }));
jest.mock('../../src/modules/chatbot/seller-tool-executor.service', () => ({
  ...jest.requireActual('../../src/modules/chatbot/seller-tool-executor.service'),
  executeSellerTool: jest.fn(),
}));
jest.mock('axios');

import axios from 'axios';

import { prisma } from '../../src/core/prisma';
import { runAgentLoop } from '../../src/modules/chatbot/agent-loop.service';
import { buildBuyerContext } from '../../src/modules/chatbot/buyer-context-builder.service';
import { sendBuyerMessage } from '../../src/modules/chatbot/buyer-chat.service';
import { sendBuyerMessageSchema } from '../../src/modules/chatbot/buyer-chat.dto';
import { executeBuyerTool } from '../../src/modules/chatbot/buyer-tool-executor.service';
import { findStoreItems, searchCatalog } from '../../src/modules/chatbot/product-search.service';
import { runScopedAgentLoop } from '../../src/modules/chatbot/scoped-agent.service';
import { buildSellerContext } from '../../src/modules/chatbot/seller-context-builder.service';
import { sendSellerMessage } from '../../src/modules/chatbot/seller-chat.service';
import { executeSellerTool } from '../../src/modules/chatbot/seller-tool-executor.service';
import { chatWithLocalModel } from '../../src/modules/chatbot/slm-client';

const PRODUCT = '00000000-0000-4000-8000-000000000001';
const REQUEST = '11111111-1111-4111-8111-111111111111';
const buyerContext = { storeId: 7n, store: { publicId: 'store-public', name: 'Zainab Fashion House', slug: 'zainab' }, cart: null };
const buyer = { sub: 'buyer-public', role: 'GUEST' };

describe('chat modes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(buildBuyerContext).mockResolvedValue(buyerContext as never);
    jest.mocked(prisma.chatSession.create).mockResolvedValue({ id: 'session12345' } as never);
    jest.mocked(prisma.chatMessage.findMany).mockResolvedValue([] as never);
    jest.mocked(prisma.chatMessage.findUnique).mockResolvedValue(null as never);
    jest.mocked(prisma.chatMessage.create).mockResolvedValue({} as never);
    jest.mocked(runAgentLoop).mockResolvedValue({ finalReply: 'Model reply', steps: [] });
    jest.mocked(searchCatalog).mockResolvedValue({ items: [{ productId: PRODUCT, titleEn: 'Black Cotton Shirt', price: '1500', stock: 4, category: 'Shirts' }], total: 1 });
    jest.mocked(findStoreItems).mockResolvedValue([{ productId: PRODUCT, titleEn: 'Black Cotton Shirt', price: '1500', stock: 4, category: 'Shirts' }]);
  });

  it('treats the product page the chat was opened from as "this" product', async () => {
    const result = await sendBuyerMessage('zainab', { message: 'Iski price kya hai?', locale: 'en', mode: 'fast', productId: PRODUCT }, buyer);
    expect(findStoreItems).toHaveBeenCalledWith(7n, [PRODUCT]);
    expect(result.reply).toContain('Black Cotton Shirt ki price Rs. 1,500');
    expect(runAgentLoop).not.toHaveBeenCalled();
  });

  it('accepts only the allowlisted modes', () => {
    expect(sendBuyerMessageSchema.safeParse({ message: 'hi', mode: 'fast' }).success).toBe(true);
    expect(sendBuyerMessageSchema.safeParse({ message: 'hi', mode: 'gemini' }).success).toBe(false);
    expect(sendBuyerMessageSchema.safeParse({ message: 'hi' }).success).toBe(true);
  });

  it('answers catalog questions from the database without any model call in Fast Mode', async () => {
    const result = await sendBuyerMessage('zainab', { message: 'Show me shirts', locale: 'en', mode: 'fast' }, buyer);
    expect(runAgentLoop).not.toHaveBeenCalled();
    expect(result).toMatchObject({ mode: 'fast', cartChanged: false });
    expect(result.reply).toContain('#1 Black Cotton Shirt — Rs. 1,500');
    const saved = jest.mocked(prisma.chatMessage.create).mock.calls.map(([args]) => args.data).find((data) => data.role === 'ASSISTANT');
    expect(saved?.toolResult).toMatchObject({ mode: 'fast', shopping: { refs: [PRODUCT] } });
  });

  it.each([['fast', 'gemini'], ['slow', 'ollama']] as const)('sends open questions in %s mode to %s with shared tools', async (mode, provider) => {
    await sendBuyerMessage('zainab', { message: 'What fabric is best for summer weddings?', locale: 'en', mode }, buyer);
    expect(runAgentLoop).toHaveBeenCalledWith(expect.objectContaining({
      provider,
      tools: expect.arrayContaining([expect.objectContaining({ name: 'add_to_cart' }), expect.objectContaining({ name: 'remove_from_cart' })]),
    }));
  });

  it('keeps the original flow for requests without a mode', async () => {
    await sendBuyerMessage('zainab', { message: 'What fabric is best for summer weddings?', locale: 'en' }, buyer);
    const params = jest.mocked(runAgentLoop).mock.calls[0]?.[0];
    expect(params?.provider).toBeUndefined();
    expect(params?.tools.some((tool) => tool.name === 'remove_from_cart')).toBe(false);
  });

  it('does not repeat a cart change when a request is retried after a lost response', async () => {
    jest.mocked(prisma.chatMessage.findMany).mockImplementation((async (args: { where?: { role?: string } }) =>
      args.where?.role === 'ASSISTANT' ? [{ toolResult: { shopping: { refs: [PRODUCT], offset: 0, focus: PRODUCT } } }] : []) as never);
    jest.mocked(prisma.chatMessage.findUnique).mockImplementation((async (args: { where: { id: string } }) =>
      args.where.id === `c:${REQUEST}` ? { toolResult: { ok: true, quantityAdded: 2 } } : null) as never);
    const result = await sendBuyerMessage('zainab', { message: 'add 2 of #1', locale: 'en', mode: 'fast', requestId: REQUEST }, buyer);
    expect(executeBuyerTool).not.toHaveBeenCalled();
    expect(result.reply).toContain('Added 2 × Black Cotton Shirt');
  });

  it('records the cart result before replying, so a retry can reuse it', async () => {
    jest.mocked(prisma.chatMessage.findMany).mockImplementation((async (args: { where?: { role?: string } }) =>
      args.where?.role === 'ASSISTANT' ? [{ toolResult: { shopping: { refs: [PRODUCT], offset: 0 } } }] : []) as never);
    jest.mocked(executeBuyerTool).mockResolvedValue({ ok: true, quantityAdded: 1 });
    const result = await sendBuyerMessage('zainab', { message: 'add #1', locale: 'en', mode: 'slow', requestId: REQUEST }, buyer);
    expect(executeBuyerTool).toHaveBeenCalledTimes(1);
    expect(prisma.chatMessage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: `c:${REQUEST}`, role: 'TOOL' }) });
    expect(result).toMatchObject({ cartChanged: true, mode: 'slow' });
  });

  it('lets a model make at most one cart change per message', async () => {
    jest.mocked(executeBuyerTool).mockResolvedValue({ ok: true, quantityAdded: 1 });
    jest.mocked(runAgentLoop).mockImplementation(async (params) => {
      const call = { type: 'add_to_cart', payload: { productId: PRODUCT, quantity: 1, variantAttributes: {} } };
      const first = await params.toolExecutor(call);
      const second = await params.toolExecutor(call);
      return { finalReply: 'Done', steps: [{ toolCall: call, toolResult: first }, { toolCall: call, toolResult: second }] };
    });
    await sendBuyerMessage('zainab', { message: 'Please grab that wedding outfit we talked about for me', locale: 'en', mode: 'fast' }, buyer);
    expect(executeBuyerTool).toHaveBeenCalledTimes(1);
  });

  it('surfaces a Fast Mode provider failure instead of switching to Ollama', async () => {
    const failure = Object.assign(new Error('Fast Mode is not configured on the server'), { code: 'FAST_MODE_NOT_CONFIGURED' });
    jest.mocked(runAgentLoop).mockRejectedValue(failure);
    await expect(sendBuyerMessage('zainab', { message: 'What fabric is best for summer weddings?', locale: 'en', mode: 'fast' }, buyer))
      .rejects.toMatchObject({ code: 'FAST_MODE_NOT_CONFIGURED' });
    expect(runAgentLoop).toHaveBeenCalledTimes(1);
  });

  describe('seller assistant', () => {
    beforeEach(() => {
      jest.mocked(buildSellerContext).mockResolvedValue({ sellerId: 9n, storeName: 'Zainab Fashion House' } as never);
      jest.mocked(prisma.chatSession.findFirst).mockResolvedValue({ id: 'session12345' } as never);
    });

    it('answers inventory counts from the inventory tool without a model in Fast Mode', async () => {
      jest.mocked(executeSellerTool).mockResolvedValue({ totalProducts: 12, inventorySummary: { inStockProducts: 10, outOfStockProducts: 2 } });
      const result = await sendSellerMessage(9n, { message: 'How many products do I have?', locale: 'en', mode: 'fast' });
      expect(runAgentLoop).not.toHaveBeenCalled();
      expect(result.reply).toBe('Your store has 12 products in total: 10 in stock and 2 out of stock.');
    });

    it('uses Gemini in Fast Mode and maps an off-topic flag to the scope refusal', async () => {
      jest.mocked(runAgentLoop).mockResolvedValue({ finalReply: 'OUT_OF_SCOPE', steps: [] });
      const result = await sendSellerMessage(9n, { message: 'Write me a poem about cricket', locale: 'en', mode: 'fast' });
      expect(runAgentLoop).toHaveBeenCalledWith(expect.objectContaining({ provider: 'gemini' }));
      expect(result.reply).toContain("outside the seller assistant's scope");
    });

    it('keeps the embedding scope guard and Ollama in Slow Mode', async () => {
      jest.mocked(runScopedAgentLoop).mockResolvedValue({ finalReply: 'Sales were steady.', steps: [] });
      await sendSellerMessage(9n, { message: 'What are my sales trends?', locale: 'en', mode: 'slow' });
      expect(runScopedAgentLoop).toHaveBeenCalled();
      expect(jest.mocked(runScopedAgentLoop).mock.calls[0]?.[0]).not.toHaveProperty('provider');
    });

    it('still refuses write requests in every mode', async () => {
      const result = await sendSellerMessage(9n, { message: 'Change the price of my shirt to 900', locale: 'en', mode: 'fast' });
      expect(result.reply).toContain('I can only read your store data');
      expect(runAgentLoop).not.toHaveBeenCalled();
    });
  });

  describe('model client', () => {
    it('sends the Gemini provider only for Fast Mode', async () => {
      jest.mocked(axios.post).mockResolvedValue({ data: { reply: 'ok' } });
      await chatWithLocalModel([{ role: 'user', content: 'hi' }], [], 'gemini');
      await chatWithLocalModel([{ role: 'user', content: 'hi' }], []);
      expect(jest.mocked(axios.post).mock.calls[0]?.[1]).toEqual({ messages: [{ role: 'user', content: 'hi' }], tools: [], provider: 'gemini' });
      expect(jest.mocked(axios.post).mock.calls[1]?.[1]).toEqual({ messages: [{ role: 'user', content: 'hi' }], tools: [] });
    });

    it.each([
      ['GEMINI_NOT_CONFIGURED', 'FAST_MODE_NOT_CONFIGURED'],
      ['GEMINI_RATE_LIMITED', 'FAST_MODE_RATE_LIMITED'],
      ['GEMINI_TIMEOUT', 'FAST_MODE_TIMEOUT'],
      ['SOMETHING_ELSE', 'FAST_MODE_UNAVAILABLE'],
    ])('maps %s to %s', async (detail, code) => {
      jest.mocked(axios.isAxiosError).mockReturnValue(true);
      jest.mocked(axios.post).mockRejectedValue({ response: { data: { detail: { code: detail } } } });
      await expect(chatWithLocalModel([], [], 'gemini')).rejects.toMatchObject({ code });
    });
  });
});
