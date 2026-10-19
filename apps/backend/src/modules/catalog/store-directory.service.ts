import { Prisma } from '@prisma/client';

import { NotFoundError } from '../../core/errors/AppError';
import { prisma } from '../../core/prisma';
import { redis } from '../../core/redis';

export type StoreDirectoryQuery = {
  q?: string;
  categorySlug?: string;
  sort: 'name' | 'newest' | 'most_products';
  page: number;
  limit: number;
};

export async function listPublicStores(query: StoreDirectoryQuery) {
  if (query.categorySlug) {
    const category = await prisma.category.findUnique({ where: { slug: query.categorySlug }, select: { categoryId: true } });
    if (!category) throw new NotFoundError('Category not found', undefined, 'CATEGORY_NOT_FOUND');
  }
  const liveProduct: Prisma.ProductWhereInput = {
    status: 'LIVE',
    deletedAt: null,
    ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
  };
  const where: Prisma.SellerProfileWhereInput = {
    deletedAt: null,
    onboardingCompletedAt: { not: null },
    user: { status: 'ACTIVE', role: 'SELLER', deletedAt: null },
    products: { some: liveProduct },
    ...(query.q ? { OR: [
      { storeName: { contains: query.q, mode: 'insensitive' } },
      { storeDescription: { contains: query.q, mode: 'insensitive' } },
      { storeDescriptionUr: { contains: query.q, mode: 'insensitive' } },
    ] } : {}),
  };
  const select = {
    userId: true,
    storeSlug: true,
    storeName: true,
    storeDescription: true,
    storeDescriptionUr: true,
    logoUrl: true,
    createdAt: true,
    city: true,
    storeCategory: { select: { categoryId: true, slug: true, nameEn: true, nameUr: true } },
    _count: { select: { products: { where: liveProduct } } },
  } as const;
  const total = await prisma.sellerProfile.count({ where });
  let sellers;
  if (query.sort === 'most_products') {
    // Group only published products. Sorting on SellerProfile.products._count would
    // include drafts and deleted listings, producing a misleading public ranking.
    const ranks = await prisma.product.groupBy({
      by: ['sellerId'],
      where: {
        ...liveProduct,
        seller: where,
      },
      _count: { productId: true },
      orderBy: [{ _count: { productId: 'desc' } }, { sellerId: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    const rows = await prisma.sellerProfile.findMany({
      where: { ...where, userId: { in: ranks.map((rank) => rank.sellerId) } },
      select,
    });
    const byId = new Map(rows.map((row) => [row.userId, row]));
    sellers = ranks.flatMap((rank) => {
      const row = byId.get(rank.sellerId);
      return row ? [row] : [];
    });
  } else {
    sellers = await prisma.sellerProfile.findMany({
      where,
      orderBy: query.sort === 'newest'
        ? [{ createdAt: 'desc' }, { userId: 'desc' }]
        : [{ storeName: 'asc' }, { userId: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select,
    });
  }
  return {
    items: sellers.map((seller) => ({
      slug: seller.storeSlug,
      name: seller.storeName,
      description: seller.storeDescription,
      descriptionUr: seller.storeDescriptionUr,
      logoUrl: seller.logoUrl,
      memberSince: seller.createdAt.toISOString(),
      category: seller.storeCategory ? {
        id: seller.storeCategory.categoryId.toString(),
        slug: seller.storeCategory.slug,
        nameEn: seller.storeCategory.nameEn,
        nameUr: seller.storeCategory.nameUr,
      } : null,
      city: seller.city,
      productCount: seller._count.products,
    })),
    page: query.page,
    limit: query.limit,
    total,
    hasMore: query.page * query.limit < total,
  };
}

const FEATURED_CACHE_KEY = 'cache:f21:featured-stores:v3';
const FEATURED_CACHE_SECONDS = 45;

export async function getFeaturedStores() {
  try {
    const cached = await redis.get(FEATURED_CACHE_KEY);
    if (cached) return JSON.parse(cached) as Awaited<ReturnType<typeof listPublicStores>>['items'];
  } catch {
    // The public directory can still be served when Redis is unavailable.
  }
  // No merchandising/featured flag exists yet, so the newest eligible stores
  // are used. This is a deterministic public listing, not a paid endorsement.
  const items = (await listPublicStores({ sort: 'newest', page: 1, limit: 8 })).items;
  try {
    await redis.set(FEATURED_CACHE_KEY, JSON.stringify(items), 'EX', FEATURED_CACHE_SECONDS);
  } catch {
    // Cache failure must not hide otherwise available stores.
  }
  return items;
}
