import '../src/core/config';
import { logger } from '../src/core/logger';
import { prisma } from '../src/core/prisma';
import { syncProductEmbedding } from '../src/modules/chatbot/product-embedding.service';

async function main(): Promise<void> {
  const products = await prisma.product.findMany({
    where: { status: 'LIVE', deletedAt: null },
    select: { productId: true },
    orderBy: { productId: 'asc' },
  });
  let succeeded = 0;
  let failed = 0;
  for (const product of products) {
    try {
      const result = await syncProductEmbedding(product.productId);
      if (result === 'upserted') succeeded += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      logger.error({ productId: product.productId.toString(), err: error }, 'product embedding backfill failed');
    }
  }
  logger.info({ total: products.length, succeeded, failed }, 'product embedding backfill finished');
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    logger.error({ err: error }, 'product embedding backfill aborted');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
