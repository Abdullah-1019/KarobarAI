import { prisma } from '../src/core/prisma';
import { syncProductEmbedding } from '../src/modules/chatbot/product-embedding.service';

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', 'postgres'].includes(database.hostname) || database.pathname !== '/karobarai') {
    throw new Error('Demo embeddings require the karobarai development database');
  }
  const products = await prisma.product.findMany({
    where: { seller: { storeDescription: 'chatbot-demo-fixture-v1' }, status: 'LIVE', deletedAt: null },
    select: { productId: true }, orderBy: { productId: 'asc' },
  });
  let embedded = 0;
  for (const product of products) {
    const result = await syncProductEmbedding(product.productId);
    if (result === 'upserted') embedded++;
  }
  console.log(`Embedded ${embedded}/${products.length} demo products.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
