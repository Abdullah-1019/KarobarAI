import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { prisma } from '../../src/core/prisma';
import { retrieveRelevantProducts, buildProductRetrievalQuery } from '../../src/modules/chatbot/rag.service';
import { createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb } from '../helpers/reset';

beforeEach(async () => resetDb());

afterAll(async () => prisma.$disconnect());

describe('product RAG query isolation', () => {
  it('applies seller/store scope in the vector-search SQL itself', () => {
    const query = buildProductRetrievalQuery('42', '[0.1,0.2]', 8);
    expect(query.sql).toContain('p."seller_id" =');
    expect(query.sql).toContain('INNER JOIN "product_embeddings"');
    expect(query.sql).toContain('p."status" = \'LIVE\'::product_status');
    expect(query.sql).toContain('e."embedding" <=>');
    expect(query.sql).toContain('LIMIT');
    expect(query.values).toContain(BigInt(42));
    expect(query.values).toContain('[0.1,0.2]');
  });

  it('never returns another store product even when its vector is a closer match', async () => {
    const storeA = await createTestUser('SELLER', { onboarded: true });
    const storeB = await createTestUser('SELLER', { onboarded: true });
    const productA = await createTestProduct(storeA.userId, { titleEn: 'Store A product', status: 'LIVE' });
    const productB = await createTestProduct(storeB.userId, { titleEn: 'Store B product', status: 'LIVE' });
    const queryVector = [1, ...Array(767).fill(0)];
    const distantVector = [0, 1, ...Array(766).fill(0)];

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "product_embeddings" ("id", "product_id", "embedding", "updated_at")
      VALUES (${randomUUID()}, ${productA.productId}, ${`[${distantVector.join(',')}]`}::vector, NOW()),
             (${randomUUID()}, ${productB.productId}, ${`[${queryVector.join(',')}]`}::vector, NOW())
    `);

    const results = await retrieveRelevantProducts(storeA.userId, queryVector, 1);
    expect(results.map((product) => product.productId)).toEqual([productA.productId]);
    expect(results.some((product) => product.productId === productB.productId)).toBe(false);
  });
});
