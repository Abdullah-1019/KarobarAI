jest.mock('../../src/core/prisma', () => ({
  prisma: {
    sellerProfile: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
  },
}));
jest.mock('../../src/modules/cart/cart.service', () => ({ getCart: jest.fn() }));

import { prisma } from '../../src/core/prisma';
import * as cartService from '../../src/modules/cart/cart.service';
import { buildBuyerContext, getPublicStorefront } from '../../src/modules/chatbot/buyer-context-builder.service';

const store = {
  userId: 41n,
  user: { publicId: 'seller-public-id', status: 'ACTIVE' },
  storeSlug: 'sample-store-seller-id',
  storeName: 'Sample Store',
  storeDescription: 'Seller-provided description',
  logoUrl: null,
  bannerUrl: null,
  deletedAt: null,
  onboardingCompletedAt: new Date(),
};

describe('buyer context builder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves the store by slug and excludes products from the agent context', async () => {
    jest.mocked(prisma.sellerProfile.findUnique).mockResolvedValue(store as never);
    jest.mocked(cartService.getCart).mockResolvedValue({
      sellerGroups: [
        { sellerId: 'seller-public-id', items: [] },
        { sellerId: 'another-seller', items: [{ titleEn: 'Other store item' }] },
      ],
      grandSubtotal: '0.00',
    } as never);

    const context = await buildBuyerContext('sample-store-seller-id', 9n);

    expect(prisma.sellerProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { storeSlug: 'sample-store-seller-id' },
    }));
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(context).not.toHaveProperty('products');
    expect(context.cart?.sellerGroups).toEqual([{ sellerId: 'seller-public-id', items: [] }]);
  });

  it('returns only live store products for the public store page', async () => {
    jest.mocked(prisma.sellerProfile.findUnique).mockResolvedValue(store as never);
    jest.mocked(prisma.product.findMany).mockResolvedValue([] as never);

    await getPublicStorefront('sample-store-seller-id');

    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { sellerId: 41n, status: 'LIVE', deletedAt: null },
      take: 24,
    }));
  });
});
