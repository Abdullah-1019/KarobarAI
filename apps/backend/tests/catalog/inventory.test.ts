import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { decrementStock, restoreStock } from '../../src/modules/catalog/catalog.service';
import { createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

// Task 5.1/5.2/5.3 — decrementStock/restoreStock have no HTTP route or caller yet (a documented
// cross-feature contract for the future Cart & Checkout feature, Task 8's explicit note) — tested
// directly as service functions, not via Supertest.
describe('decrementStock / restoreStock (Task 5 — cross-feature contract)', () => {
  it('decrements stock atomically when sufficient stock exists', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { stock: 5, status: 'LIVE' });

    await decrementStock(product.productId, 3);

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.stock).toBe(2);
    expect(row.status).toBe('LIVE');
  });

  it('rejects (ConflictError/INSUFFICIENT_STOCK) when stock is insufficient, without mutating it', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { stock: 2, status: 'LIVE' });

    await expect(decrementStock(product.productId, 5)).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      statusCode: 409,
    });

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.stock).toBe(2);
  });

  // Task 5.3 — stock reaching exactly 0 auto-transitions LIVE -> OUT_OF_STOCK.
  it('transitions LIVE -> OUT_OF_STOCK when stock reaches exactly 0', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { stock: 3, status: 'LIVE' });

    await decrementStock(product.productId, 3);

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.stock).toBe(0);
    expect(row.status).toBe('OUT_OF_STOCK');
  });

  it('restoreStock transitions OUT_OF_STOCK -> LIVE when stock moves above 0', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { stock: 0, status: 'OUT_OF_STOCK' });

    await restoreStock(product.productId, 4);

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.stock).toBe(4);
    expect(row.status).toBe('LIVE');
  });

  // Task 5.3's exclusion case — a DRAFT product's stock reaching 0 must NOT transition to
  // OUT_OF_STOCK; that state applies only to LIVE listings.
  it('does not transition a DRAFT product to OUT_OF_STOCK when its stock reaches 0', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { stock: 2, status: 'DRAFT' });

    await decrementStock(product.productId, 2);

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.stock).toBe(0);
    expect(row.status).toBe('DRAFT');
  });

  // Task 5.1/8.3 — concurrency: N concurrent decrements exceeding available stock, only the
  // exact affordable count succeed (Promise.all, not sequential awaits, to genuinely race).
  it('under concurrent decrements only the exact affordable count succeed (stock=1, two callers)', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { stock: 1, status: 'LIVE' });

    const results = await Promise.allSettled([
      decrementStock(product.productId, 1),
      decrementStock(product.productId, 1),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    expect(row.stock).toBe(0);
    expect(row.status).toBe('OUT_OF_STOCK');
  });

  it('order-independent correctness: a concurrent decrement racing a restore ends at the correct final stock', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { stock: 5, status: 'LIVE' });

    await Promise.all([decrementStock(product.productId, 5), restoreStock(product.productId, 3)]);

    const row = await prisma.product.findUniqueOrThrow({ where: { productId: product.productId } });
    // Final stock must be 3 regardless of interleaving (5 - 5 + 3), and status must reflect it.
    expect(row.stock).toBe(3);
    expect(row.status).toBe('LIVE');
  });
});
