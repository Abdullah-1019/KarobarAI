import type { Prisma } from '@prisma/client';

import { prisma } from '../../core/prisma';

// Database-backed catalog search shared by both assistant modes. Every query is scoped to one
// store's live, non-deleted listings; price and stock always come from the product row.

export interface SearchSpec {
  terms: string[];
  stock: 'any' | 'in' | 'out';
  minPrice?: number;
  maxPrice?: number;
  /** Products in the same category as this product (excluding it). */
  similarTo?: string;
}

export interface CatalogItem {
  productId: string;
  titleEn: string;
  price: string;
  stock: number;
  category: string | null;
}

export const PAGE_SIZE = 8;

const select = {
  publicId: true, titleEn: true, price: true, stock: true, categoryId: true,
  category: { select: { nameEn: true } },
} satisfies Prisma.ProductSelect;

type Row = Prisma.ProductGetPayload<{ select: typeof select }>;

export function toCatalogItem(row: Row): CatalogItem {
  return {
    productId: row.publicId, titleEn: row.titleEn, price: row.price.toString(),
    stock: row.stock, category: row.category?.nameEn ?? null,
  };
}

/** shirts → shirt, shoes → shoe, dresses → dress; short words are left alone. */
export function stemTerm(word: string): string {
  const lower = word.toLowerCase();
  if (lower.length > 4 && /(?:ches|shes|sses|xes)$/.test(lower)) return lower.slice(0, -2);
  if (lower.length > 3 && lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
}

function termFilter(term: string, withDescription: boolean): Prisma.ProductWhereInput {
  const contains = { contains: term, mode: 'insensitive' as const };
  return {
    OR: [
      { titleEn: contains },
      { category: { OR: [{ nameEn: contains }, { slug: contains }] } },
      ...(withDescription ? [{ descriptionEn: contains }] : []),
    ],
  };
}

async function baseWhere(storeId: bigint, spec: SearchSpec, withDescription: boolean): Promise<Prisma.ProductWhereInput | null> {
  const and: Prisma.ProductWhereInput[] = [{ sellerId: storeId, status: 'LIVE', deletedAt: null }];
  if (spec.stock === 'in') and.push({ stock: { gt: 0 } });
  if (spec.stock === 'out') and.push({ stock: { lte: 0 } });
  if (spec.minPrice !== undefined || spec.maxPrice !== undefined) {
    and.push({ price: { ...(spec.minPrice !== undefined ? { gte: spec.minPrice } : {}), ...(spec.maxPrice !== undefined ? { lte: spec.maxPrice } : {}) } });
  }
  if (spec.similarTo) {
    const source = await prisma.product.findFirst({
      where: { publicId: spec.similarTo, sellerId: storeId, status: 'LIVE', deletedAt: null },
      select: { productId: true, categoryId: true, titleEn: true },
    });
    if (!source) return null;
    and.push({ productId: { not: source.productId } });
    if (source.categoryId) and.push({ categoryId: source.categoryId });
    else {
      const word = source.titleEn.split(/\s+/).map(stemTerm).sort((a, b) => b.length - a.length)[0];
      if (word) and.push(termFilter(word, false));
    }
  }
  for (const term of spec.terms) and.push(termFilter(stemTerm(term), withDescription));
  return { AND: and };
}

/**
 * One bounded page of matching products plus the true total. Title/category matching is tried
 * first; descriptions are searched only when that finds nothing, so a generic word does not pull
 * in unrelated listings.
 */
export async function searchCatalog(storeId: bigint, spec: SearchSpec, page = 0, pageSize = PAGE_SIZE) {
  const run = async (withDescription: boolean) => {
    const where = await baseWhere(storeId, spec, withDescription);
    if (!where) return { items: [] as CatalogItem[], total: 0 };
    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where, select,
        orderBy: [{ titleEn: 'asc' }, { productId: 'asc' }],
        skip: page * pageSize, take: pageSize,
      }),
    ]);
    return { items: rows.map(toCatalogItem), total };
  };
  const result = await run(false);
  if (result.total > 0 || !spec.terms.length) return result;
  return run(true);
}

/** Live products of this store by public id, in the requested order; foreign or removed ids are dropped. */
export async function findStoreItems(storeId: bigint, productIds: string[]): Promise<CatalogItem[]> {
  if (!productIds.length) return [];
  const rows = await prisma.product.findMany({
    where: { publicId: { in: productIds }, sellerId: storeId, status: 'LIVE', deletedAt: null },
    select,
  });
  const byId = new Map(rows.map((row) => [row.publicId, toCatalogItem(row)]));
  return productIds.map((id) => byId.get(id)).filter((item): item is CatalogItem => Boolean(item));
}
