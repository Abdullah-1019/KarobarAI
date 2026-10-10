import request from 'supertest';
import { randomUUID } from 'node:crypto';

import { config } from '../../src/core/config';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { signAccessToken } from '../../src/core/jwt';
import { app } from '../../src/server';
import { getOrderAnalytics, getRevenueSummary } from '../../src/modules/analytics/analytics.service';
import { buildSellerContext } from '../../src/modules/chatbot/seller-context-builder.service';
import { executeSellerTool } from '../../src/modules/chatbot/seller-tool-executor.service';

const liveDescribe = process.env.RUN_LIVE_SELLER_ASSISTANT_TEST === '1' ? describe : describe.skip;

liveDescribe('Feature 18 isolated live seller assistant integration', () => {
  const unique = randomUUID().replace(/-/g, '');
  let sellerId: bigint;
  let sellerPublicId: string;
  let otherSellerId: bigint;
  let emptySellerId: bigint;
  let buyerId: bigint;
  let sellerToken: string;
  let otherSellerToken: string;
  let emptySellerToken: string;
  let orderPublicId: string;
  let foreignOrderPublicId: string;
  let foreignSessionId: string;

  beforeAll(async () => {
    const database = new URL(config.databaseUrl);
    const redisUrl = new URL(config.redisUrl);
    if (database.hostname !== '127.0.0.1' || database.pathname !== '/f18test' || redisUrl.hostname !== '127.0.0.1') {
      throw new Error('Live seller integration requires the disposable 127.0.0.1 f18test database and isolated Redis.');
    }
    if (!config.jwt.privateKey || !config.jwt.publicKey) throw new Error('JWT keys are required for the live authenticated route check.');

    const seller = await prisma.user.create({
      data: {
        email: `seller-${unique}@example.test`, emailBidx: `seller-${unique}`,
        role: 'SELLER', status: 'ACTIVE',
        sellerProfile: { create: { storeName: `Feature18 ${unique}`, storeSlug: `f18-${unique}`, onboardingCompletedAt: new Date() } },
      },
      select: { userId: true, publicId: true },
    });
    sellerId = seller.userId; sellerPublicId = seller.publicId;
    const otherSeller = await prisma.user.create({
      data: {
        email: `other-${unique}@example.test`, emailBidx: `other-${unique}`,
        role: 'SELLER', status: 'ACTIVE',
        sellerProfile: { create: { storeName: `Other ${unique}`, storeSlug: `other-${unique}`, onboardingCompletedAt: new Date() } },
      },
      select: { userId: true, publicId: true },
    });
    otherSellerId = otherSeller.userId;
    const emptySeller = await prisma.user.create({
      data: {
        email: `empty-${unique}@example.test`, emailBidx: `empty-${unique}`,
        role: 'SELLER', status: 'ACTIVE',
        sellerProfile: { create: { storeName: `Empty ${unique}`, storeSlug: `empty-${unique}`, onboardingCompletedAt: new Date() } },
      },
      select: { userId: true, publicId: true },
    });
    emptySellerId = emptySeller.userId;
    const buyer = await prisma.user.create({
      data: { email: `buyer-${unique}@example.test`, emailBidx: `buyer-${unique}`, role: 'BUYER', status: 'ACTIVE', buyerProfile: { create: {} } },
      select: { userId: true },
    });
    buyerId = buyer.userId;

    const product = await prisma.product.create({
      data: { sellerId, titleEn: `Feature18 Lamp ${unique}`, price: '100.00', stock: 0, status: 'OUT_OF_STOCK' },
      select: { productId: true, publicId: true, titleEn: true },
    });
    await prisma.product.create({ data: { sellerId, titleEn: `Feature18 Shelf ${unique}`, price: '200.00', stock: 4, status: 'LIVE' } });
    const foreignProduct = await prisma.product.create({ data: { sellerId: otherSellerId, titleEn: `Private Product ${unique}`, price: '200.00', stock: 3, status: 'LIVE' }, select: { productId: true, titleEn: true } });
    const foreignOrder = await prisma.order.create({
      data: {
        buyerId, sellerId: otherSellerId, status: 'PROCESSING', paymentMethod: 'COD', subtotal: '200.00', totalAmount: '200.00',
        commissionRateSnapshot: '0.0500', shipName: 'Integration Buyer', shipLine1: 'private address', shipCity: 'Lahore',
        shipProvince: 'Punjab', shipPhone: 'private phone',
        items: { create: [{ productId: foreignProduct.productId, titleSnapshot: foreignProduct.titleEn, unitPrice: '200.00', quantity: 1 }] },
      },
      select: { publicId: true },
    });
    foreignOrderPublicId = foreignOrder.publicId;
    const completedOrder = await prisma.order.create({
      data: {
        buyerId, sellerId, status: 'COMPLETED', paymentMethod: 'COD', subtotal: '100.00', totalAmount: '100.00',
        commissionRateSnapshot: '0.0500', shipName: 'Integration Buyer', shipLine1: 'private address', shipCity: 'Lahore',
        shipProvince: 'Punjab', shipPhone: 'private phone', deliveredAt: new Date(),
        items: { create: [{ productId: product.productId, titleSnapshot: product.titleEn, unitPrice: '100.00', quantity: 1 }] },
      },
      select: { orderId: true, publicId: true },
    });
    orderPublicId = completedOrder.publicId;
    const processingOrder = await prisma.order.create({
      data: {
        buyerId, sellerId, status: 'PROCESSING', paymentMethod: 'COD', subtotal: '200.00', totalAmount: '200.00',
        commissionRateSnapshot: '0.0500', shipName: 'Integration Buyer', shipLine1: 'private address', shipCity: 'Lahore',
        shipProvince: 'Punjab', shipPhone: 'private phone',
        items: { create: [{ productId: product.productId, titleSnapshot: product.titleEn, unitPrice: '100.00', quantity: 2 }] },
      },
      select: { publicId: true },
    });
    orderPublicId = processingOrder.publicId;
    await prisma.settlement.create({ data: { orderId: completedOrder.orderId, sellerId, gross: '100.00', commission: '10.00', net: '90.00', status: 'SETTLED', settledAt: new Date() } });
    await prisma.return.create({ data: { orderId: completedOrder.orderId, sellerId, reason: 'test return', status: 'INITIATED' } });
    await prisma.review.create({ data: { buyerId, productId: product.productId, orderId: completedOrder.orderId, rating: 2, comment: 'test review' } });

    const foreignSession = await prisma.chatSession.create({ data: { context: 'SELLER_ASSISTANT', sellerId: otherSellerId }, select: { id: true } });
    foreignSessionId = foreignSession.id;
    sellerToken = signAccessToken(sellerPublicId, 'SELLER', `seller-${unique}`);
    otherSellerToken = signAccessToken(otherSeller.publicId, 'SELLER', `other-${unique}`);
    emptySellerToken = signAccessToken(emptySeller.publicId, 'SELLER', `empty-${unique}`);
  }, 30_000);

  afterAll(async () => {
    redis.disconnect();
    await prisma.$disconnect();
  });

  it('runs each tool against actual isolated seller-owned data and excludes another seller', async () => {
    const context = await buildSellerContext(sellerId);
    const revenueCheck = await getRevenueSummary(sellerId, { range: '30d' });
    const orderCheck = await getOrderAnalytics(sellerId, { range: '30d' });
    expect(revenueCheck.current).toBe('90.00');
    expect(orderCheck.totalOrders).toBe(2);
    const sales = await executeSellerTool(context, { type: 'get_sales_summary', payload: { period: '30d' } }) as { settledRevenue: string; orders: number };
    expect(sales).toMatchObject({ settledRevenue: '90.00', orders: 2 });

    const order = await executeSellerTool(context, { type: 'get_order_status', payload: { orderId: orderPublicId } }) as { count: number; orders: Array<{ status: string }> };
    expect(order.count).toBe(1);
    expect(order.orders[0]?.status).toBe('PROCESSING');
    expect(order.orders[0]).not.toHaveProperty('shipName');
    const foreignOrder = await executeSellerTool(context, { type: 'get_order_status', payload: { orderId: foreignOrderPublicId } }) as { count: number; orders: unknown[] };
    expect(foreignOrder).toEqual({ count: 0, orders: [] });

    const top = await executeSellerTool(context, { type: 'get_top_products', payload: { period: '30d', limit: 5 } }) as { items: Array<{ titleEn: string }> };
    expect(top.items[0]?.titleEn).toContain('Feature18 Lamp');
    const inventory = await executeSellerTool(context, { type: 'get_inventory_status', payload: { lowStockOnly: false } }) as { items: Array<{ titleEn: string }>; totalProducts: number; returnedProducts: number; hasMore: boolean; inventorySummary: { inStockProducts: number; outOfStockProducts: number } };
    expect(inventory).toMatchObject({ totalProducts: 2, returnedProducts: 2, hasMore: false, inventorySummary: { inStockProducts: 1, outOfStockProducts: 1 } });
    expect(inventory).not.toHaveProperty('limit');
    expect(inventory.items.map((item) => item.titleEn).join(' ')).not.toContain('Private Product');
    const zeroStock = await executeSellerTool(context, { type: 'get_inventory_status', payload: { lowStockOnly: true } }) as { items: Array<{ stock: number }> };
    expect(zeroStock.items).toEqual([expect.objectContaining({ stock: 0 })]);
    const returns = await executeSellerTool(context, { type: 'get_returns_summary', payload: { period: '30d' } }) as { total: number };
    expect(returns.total).toBe(1);
    const highReturns = await executeSellerTool(context, { type: 'get_high_return_products', payload: { limit: 5 } }) as Array<{ returnRatePercent: number }>;
    expect(highReturns[0]?.returnRatePercent).toBe(100);
    const reviews = await executeSellerTool(context, { type: 'get_review_summary', payload: { sortBy: 'lowest_rated' } }) as { totalReviews: number; averageRating: number };
    expect(reviews).toMatchObject({ totalReviews: 1, averageRating: 2 });
    const deliveries = await executeSellerTool(context, { type: 'get_delivery_stats', payload: { period: 'today' } }) as { completedDeliveries: number };
    expect(deliveries.completedDeliveries).toBe(1);
    const recommendations = await executeSellerTool(context, { type: 'generate_recommendations', payload: {} }) as Record<string, unknown>;
    expect(Object.keys(recommendations).sort()).toEqual(['inventory', 'returns', 'sales', 'topProducts']);
  }, 60_000);

  it('authenticates the live chat route, invokes local model and tools, persists conversation, and denies foreign sessions', async () => {
    const response = await request(app).post('/api/v1/seller/chat')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ message: 'Show my inventory status and tell me how many products I have.', locale: 'en' })
      .timeout({ response: 360_000, deadline: 360_000 });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.toolCalls).toBeGreaterThan(0);
    expect(response.body.data.reply).toEqual(expect.any(String));
    expect(response.body.data.reply).toMatch(/\b2\b|\btwo\b/i);
    expect(response.body.data.reply).not.toMatch(/\b(?:50|100) products?\b/i);

    const conversation = await request(app).get(`/api/v1/seller/chat/${response.body.data.sessionId}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(conversation.status).toBe(200);
    expect(conversation.body.data.messages.length).toBeGreaterThanOrEqual(2);

    const foreign = await request(app).get(`/api/v1/seller/chat/${foreignSessionId}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(foreign.status).toBe(404);

    const buyerUser = await prisma.user.findUniqueOrThrow({ where: { userId: buyerId }, select: { publicId: true } });
    const buyerToken = signAccessToken(buyerUser.publicId, 'BUYER', `buyer-${unique}`);
    const denied = await request(app).post('/api/v1/seller/chat').set('Authorization', `Bearer ${buyerToken}`).send({ message: 'sales', locale: 'en' });
    expect(denied.status).toBe(403);

    const otherSellerMismatch = await request(app).get(`/api/v1/seller/chat/${response.body.data.sessionId}`)
      .set('Authorization', `Bearer ${otherSellerToken}`);
    expect(otherSellerMismatch.status).toBe(404);
  }, 420_000);

  it('synthesizes a grounded recommendation from the real seller-scoped tool results', async () => {
    const response = await request(app).post('/api/v1/seller/chat')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        message: 'Based only on my store data, recommend one practical action. If you mention a product, use its exact name and the stock value from my data. Do not guess missing figures.',
        locale: 'en',
      })
      .timeout({ response: 480_000, deadline: 480_000 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.toolCalls).toBeGreaterThan(0);
    const reply = String(response.body.data.reply);
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: response.body.data.sessionId, role: { in: ['TOOL', 'ASSISTANT'] } },
      select: { toolCall: true, toolResult: true },
    });
    const calls = messages.map((message) => message.toolCall as { type?: string } | null).filter(Boolean);
    expect(calls.some((call) => call?.type === 'generate_recommendations')).toBe(true);
    const results = messages.map((message) => message.toolResult as Record<string, unknown> | null).filter(Boolean);
    const recommendationData = results.find((result) =>
      result && typeof result === 'object' && 'sales' in result && 'topProducts' in result && 'returns' in result && 'inventory' in result,
    );
    expect(recommendationData).toBeDefined();
    expect(JSON.stringify(recommendationData)).toContain(`Feature18 Lamp ${unique}`);
    expect(JSON.stringify(recommendationData)).not.toContain(`Private Product ${unique}`);
    expect(reply).toContain(`Feature18 Lamp ${unique}`);
    expect(reply).not.toContain(`Private Product ${unique}`);
    expect(reply).toMatch(/\b(?:0|zero|out of stock)\b/i);
    const knownNumbers = new Set((JSON.stringify(recommendationData).match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
    const responseNumbers = (reply.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
    expect(responseNumbers.every((number) => knownNumbers.has(number))).toBe(true);
  }, 540_000);

  it('does not invent performance facts for a seller with no recommendation data', async () => {
    const emptyContext = await buildSellerContext(emptySellerId);
    const source = await executeSellerTool(emptyContext, { type: 'generate_recommendations', payload: {} }) as {
      sales: { settledRevenue: string; orders: number };
      topProducts: { items: unknown[] };
      returns: unknown[];
      inventory: { items: unknown[]; totalProducts: number };
    };
    expect(source).toMatchObject({
      sales: { settledRevenue: '0.00', orders: 0 },
      topProducts: { items: [] },
      returns: [],
      inventory: { items: [], totalProducts: 0 },
    });

    const response = await request(app).post('/api/v1/seller/chat')
      .set('Authorization', `Bearer ${emptySellerToken}`)
      .send({ message: 'What performance recommendation can you make from my store data? Do not guess if data is missing.', locale: 'en' })
      .timeout({ response: 480_000, deadline: 480_000 });
    expect(response.status).toBe(200);
    expect(response.body.data.toolCalls).toBeGreaterThan(0);
    const persisted = await prisma.chatMessage.findMany({
      where: { sessionId: response.body.data.sessionId, role: { in: ['TOOL', 'ASSISTANT'] } },
      select: { toolCall: true, toolResult: true },
    });
    expect(persisted.some((message) => (message.toolCall as { type?: string } | null)?.type === 'generate_recommendations')).toBe(true);
    const savedData = persisted.find((message) => message.toolResult && JSON.stringify(message.toolResult).includes('settledRevenue'))?.toolResult;
    expect(savedData).toMatchObject(source);
    const reply = String(response.body.data.reply);
    expect(reply).not.toMatch(/\d/);
    expect(reply).not.toContain(`Feature18 Lamp ${unique}`);
    expect(reply).not.toContain(`Private Product ${unique}`);
  }, 540_000);

  it('refuses an out-of-scope request through the real embedding scope guard before model execution', async () => {
    const response = await request(app).post('/api/v1/seller/chat')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ message: 'Tell me a joke about the moon and stars.', locale: 'en' });
    expect(response.status).toBe(200);
    expect(response.body.data.toolCalls).toBe(0);
    expect(response.body.data.reply).toContain('outside the seller assistant');
  }, 30_000);
});
