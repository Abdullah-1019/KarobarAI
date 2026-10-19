import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { storeDirectoryQuerySchema } from '../../src/modules/catalog/store-directory.dto';
import { getFeaturedStores, listPublicStores } from '../../src/modules/catalog/store-directory.service';

jest.mock('../../src/core/prisma', () => ({
  prisma: {
    sellerProfile: { count: jest.fn(), findMany: jest.fn() },
    product: { groupBy: jest.fn() },
    category: { findUnique: jest.fn() },
  },
}));
jest.mock('../../src/core/redis', () => ({ redis: { get: jest.fn(), set: jest.fn() } }));

const count = prisma.sellerProfile.count as jest.Mock;
const findMany = prisma.sellerProfile.findMany as jest.Mock;
const groupBy = prisma.product.groupBy as jest.Mock;
const categoryFind = prisma.category.findUnique as jest.Mock;
const cacheGet = redis.get as jest.Mock;
const cacheSet = redis.set as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  count.mockResolvedValue(1);
  cacheGet.mockResolvedValue(null);
  cacheSet.mockResolvedValue('OK');
  groupBy.mockResolvedValue([{ sellerId: BigInt(7), _count: { productId: 2 } }]);
  categoryFind.mockResolvedValue({ categoryId: BigInt(3) });
  findMany.mockResolvedValue([{
    userId: BigInt(7),
    storeSlug: 'afzal-fabrics',
    storeName: 'Afzal Fabrics',
    storeDescription: null,
    logoUrl: null,
    city: 'Lahore',
    storeCategory: { categoryId: BigInt(3), slug: 'clothing', nameEn: 'Clothing', nameUr: 'کپڑے' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    _count: { products: 2 },
  }]);
});

describe('public store directory', () => {
  it('validates bounded pagination, category, and sort', () => {
    expect(storeDirectoryQuerySchema.parse({})).toEqual({ sort: 'name', page: 1, limit: 12 });
    expect(storeDirectoryQuerySchema.safeParse({ limit: '31' }).success).toBe(false);
    expect(storeDirectoryQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(storeDirectoryQuerySchema.safeParse({ categorySlug: '../secret' }).success).toBe(false);
    expect(storeDirectoryQuerySchema.safeParse({ sort: 'unknown' }).success).toBe(false);
    expect(storeDirectoryQuerySchema.safeParse({ q: 'x'.repeat(121) }).success).toBe(false);
    expect(storeDirectoryQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
    expect(storeDirectoryQuerySchema.safeParse({ page: '1.2' }).success).toBe(false);
    expect(storeDirectoryQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(storeDirectoryQuerySchema.parse({ sort: 'most_products' }).sort).toBe('most_products');
  });

  it('filters eligible sellers with matching live products and returns only public fields', async () => {
    const result = await listPublicStores({ q: 'afzal', categorySlug: 'clothing', sort: 'newest', page: 2, limit: 1 });
    const args = findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      deletedAt: null,
      onboardingCompletedAt: { not: null },
      user: { status: 'ACTIVE', role: 'SELLER', deletedAt: null },
      products: { some: { status: 'LIVE', deletedAt: null, category: { slug: 'clothing' } } },
    });
    expect(args.where.OR[0].storeName.contains).toBe('afzal');
    expect(args.skip).toBe(1);
    expect(args.take).toBe(1);
    expect(args.select).not.toHaveProperty('user');
    expect(args.select._count.select.products.where).toMatchObject({ status: 'LIVE', deletedAt: null, category: { slug: 'clothing' } });
    expect(result.items).toEqual([{
      slug: 'afzal-fabrics', name: 'Afzal Fabrics', description: null,
      logoUrl: null, memberSince: '2026-01-01T00:00:00.000Z', productCount: 2,
      city: 'Lahore', category: { id: '3', slug: 'clothing', nameEn: 'Clothing', nameUr: 'کپڑے' },
    }]);
  });

  it('ranks by published-product count and keeps the database order', async () => {
    const result = await listPublicStores({ sort: 'most_products', page: 1, limit: 12 });
    expect(groupBy.mock.calls[0][0]).toMatchObject({
      by: ['sellerId'],
      where: { status: 'LIVE', deletedAt: null },
      orderBy: [{ _count: { productId: 'desc' } }, { sellerId: 'asc' }],
    });
    expect(result.items[0]?.productCount).toBe(2);
  });

  it('uses only matching live products for category ranking', async () => {
    await listPublicStores({ categorySlug: 'clothing', sort: 'most_products', page: 1, limit: 12 });
    expect(groupBy.mock.calls[0][0].where).toMatchObject({ status: 'LIVE', deletedAt: null, category: { slug: 'clothing' } });
    expect(findMany.mock.calls[0][0].select._count.select.products.where).toMatchObject({ category: { slug: 'clothing' } });
  });

  it('rejects a well-formed category slug that does not exist', async () => {
    categoryFind.mockResolvedValueOnce(null);
    await expect(listPublicStores({ categorySlug: 'unknown-category', sort: 'name', page: 1, limit: 12 }))
      .rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
    expect(count).not.toHaveBeenCalled();
  });

  it('uses stable secondary keys for newest and alphabetical pagination', async () => {
    await listPublicStores({ sort: 'newest', page: 1, limit: 12 });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'desc' }, { userId: 'desc' }]);
    await listPublicStores({ sort: 'name', page: 2, limit: 1 });
    expect(findMany.mock.calls[1][0]).toMatchObject({ orderBy: [{ storeName: 'asc' }, { userId: 'asc' }], skip: 1 });
  });

  it('returns cached featured stores without another database query', async () => {
    cacheGet.mockResolvedValueOnce(JSON.stringify([{ slug: 'cached' }]));
    expect(await getFeaturedStores()).toEqual([{ slug: 'cached' }]);
    expect(count).not.toHaveBeenCalled();
  });

  it('loads eight newest stores and caches them briefly', async () => {
    await getFeaturedStores();
    expect(findMany.mock.calls[0][0]).toMatchObject({ take: 8, orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }] });
    expect(cacheSet).toHaveBeenCalledWith('cache:f21:featured-stores:v3', expect.any(String), 'EX', 45);
  });

  it('serves stores when Redis is unavailable', async () => {
    cacheGet.mockRejectedValueOnce(new Error('Redis unavailable'));
    cacheSet.mockRejectedValueOnce(new Error('Redis unavailable'));
    const stores = await getFeaturedStores();
    expect(stores[0]?.slug).toBe('afzal-fabrics');
  });
});
