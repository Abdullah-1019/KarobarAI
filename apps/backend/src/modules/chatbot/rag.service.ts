import { Prisma, type Product } from '@prisma/client';

import { prisma } from '../../core/prisma';

export async function retrieveRelevantProducts(
  storeId: string | bigint,
  queryEmbedding: number[],
  k = 8,
): Promise<Product[]> {
  if (queryEmbedding.length !== 768 || queryEmbedding.some((value) => !Number.isFinite(value))) {
    throw new TypeError('queryEmbedding must contain 768 finite values');
  }
  const sellerId = typeof storeId === 'bigint' ? storeId : BigInt(storeId);
  const limit = Number.isInteger(k) ? Math.max(1, Math.min(k, 50)) : 8;
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;
  const matches = await prisma.$queryRaw<Array<{ productId: bigint }>>(
    buildProductRetrievalQuery(sellerId, vectorLiteral, limit),
  );
  if (matches.length === 0) return [];

  const rank = new Map(matches.map((match, index) => [match.productId.toString(), index]));
  const products = await prisma.product.findMany({
    where: {
      productId: { in: matches.map((match) => match.productId) },
      sellerId,
      status: 'LIVE',
      deletedAt: null,
    },
  });
  return products.sort((left, right) => (rank.get(left.productId.toString()) ?? 0) - (rank.get(right.productId.toString()) ?? 0));
}

export function buildProductRetrievalQuery(storeId: string | bigint, vectorLiteral: string, k: number): Prisma.Sql {
  const sellerId = typeof storeId === 'bigint' ? storeId : BigInt(storeId);
  return Prisma.sql`
    SELECT p."product_id" AS "productId"
    FROM "products" AS p
    INNER JOIN "product_embeddings" AS e ON e."product_id" = p."product_id"
    WHERE p."seller_id" = ${sellerId}
      AND p."status" = 'LIVE'::product_status
      AND p."deleted_at" IS NULL
    ORDER BY e."embedding" <=> ${vectorLiteral}::vector
    LIMIT ${k}
  `;
}
