import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import {
  closeProductEmbeddingResources,
  enqueueProductEmbeddingSync,
  startProductEmbeddingWorker,
} from '../../src/modules/chatbot/product-embedding.service';
import { createTestProduct, createTestUser } from '../helpers/factories';

const liveDescribe = process.env.RUN_LIVE_EMBEDDING_TEST === '1' ? describe : describe.skip;

liveDescribe('live BullMQ product embedding pipeline', () => {
  let sellerUserId: bigint | undefined;
  let productId: bigint | undefined;

  afterAll(async () => {
    await closeProductEmbeddingResources();
    if (productId !== undefined) {
      await prisma.product.deleteMany({ where: { productId } });
    }
    if (sellerUserId !== undefined) {
      await prisma.refreshToken.deleteMany({ where: { userId: sellerUserId } });
      await prisma.sellerProfile.deleteMany({ where: { userId: sellerUserId } });
      await prisma.user.deleteMany({ where: { userId: sellerUserId } });
    }
    await prisma.$disconnect();
    await redis.quit();
  });

  it('creates, updates, and upserts one 768-dimensional embedding via a BullMQ worker', async () => {
    const seller = await createTestUser('SELLER');
    sellerUserId = seller.userId;
    const product = await createTestProduct(seller.userId, {
      titleEn: 'Live embedding verification cotton shirt',
      status: 'LIVE',
    });
    productId = product.productId;

    startProductEmbeddingWorker();
    await enqueueProductEmbeddingSync(product.productId);
    const first = await waitForEmbedding(product.productId);
    expect(first).toBeDefined();
    expect(first?.dimensions).toBe(768);

    await prisma.product.update({
      where: { productId: product.productId },
      data: { titleEn: 'Updated live embedding verification cotton shirt' },
    });
    await enqueueProductEmbeddingSync(product.productId);
    const updated = await waitForEmbedding(product.productId, first!.updatedAt);
    expect(updated).toBeDefined();
    expect(updated?.dimensions).toBe(768);
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(first!.updatedAt.getTime());
    const counts = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "product_embeddings" WHERE "product_id" = ${product.productId}
    `;
    expect(counts[0]?.count).toBe(1n);
  }, 180_000);
});

async function waitForEmbedding(productId: bigint, after?: Date) {
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    const rows = await prisma.$queryRaw<Array<{ updatedAt: Date; dimensions: number }>>`
      SELECT "updated_at" AS "updatedAt", vector_dims("embedding") AS dimensions
      FROM "product_embeddings" WHERE "product_id" = ${productId}
    `;
    if (rows[0] && (!after || rows[0].updatedAt.getTime() > after.getTime())) return rows[0];
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`ProductEmbedding was not produced or updated for product ${productId}`);
}
