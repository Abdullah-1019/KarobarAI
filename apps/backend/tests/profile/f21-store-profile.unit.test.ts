import type { Request, Response } from 'express';
import { createStoreSchema, storeSocialLinksSchema, updateSellerProfileSchema } from '@karobarai/shared';

import { authorize } from '../../src/core/middleware/authorize';
import { prisma } from '../../src/core/prisma';
import { getPublicStorefront } from '../../src/modules/chatbot/buyer-context-builder.service';
import { getMyProfile, updateSellerProfile } from '../../src/modules/profile/profile.service';
import { mergeSocialLinks, publicSocialLinks } from '../../src/modules/profile/store-social-links';

jest.mock('../../src/core/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    sellerProfile: { findUnique: jest.fn(), update: jest.fn() },
    category: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
  },
}));

const userFind = prisma.user.findUnique as jest.Mock;
const sellerFind = prisma.sellerProfile.findUnique as jest.Mock;
const sellerUpdate = prisma.sellerProfile.update as jest.Mock;
const categoryFind = prisma.category.findUnique as jest.Mock;
const productFind = prisma.product.findMany as jest.Mock;

const category = { categoryId: 3n, slug: 'clothing', nameEn: 'Clothing', nameUr: 'کپڑے' };
const seller = {
  userId: 7n,
  storeSlug: 'afzal-fabrics',
  storeName: 'Afzal Fabrics',
  storeDescription: 'Fabrics',
  city: 'Lahore',
  storeCategory: category,
  socialLinks: { facebook: 'https://www.facebook.com/afzal', whatsapp: '+923001234567' },
  logoUrl: null,
  bannerUrl: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  onboardingCompletedAt: new Date('2026-01-01T00:00:00.000Z'),
  user: { publicId: 'bb1b088b-934a-49d0-887b-c6827ea26789', role: 'SELLER', status: 'ACTIVE', deletedAt: null },
};
const user = {
  userId: 7n,
  publicId: 'bb1b088b-934a-49d0-887b-c6827ea26789',
  role: 'SELLER', status: 'ACTIVE', deletedAt: null,
  preferredLanguage: 'EN', avatarUrl: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  sellerProfile: seller,
  buyerProfile: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  userFind.mockResolvedValue(user);
  sellerFind.mockResolvedValue(seller);
  sellerUpdate.mockResolvedValue(seller);
  categoryFind.mockResolvedValue(category);
  productFind.mockResolvedValue([]);
});

describe('F21 store profile validation', () => {
  it('accepts an existing category id, city, and valid links for every platform', () => {
    const parsed = updateSellerProfileSchema.parse({
      storeCategoryId: '3', city: '  Lahore  ',
      socialLinks: {
        facebook: 'https://www.facebook.com/afzal', instagram: 'https://instagram.com/afzal',
        tiktok: 'https://www.tiktok.com/@afzal', youtube: 'https://youtu.be/example',
        whatsapp: '+92 (300) 123-4567', website: 'https://afzal.example/store',
      },
    });
    expect(parsed.city).toBe('Lahore');
    expect(parsed.socialLinks?.whatsapp).toBe('+923001234567');
  });

  it.each([
    { facebook: 'http://facebook.com/afzal' },
    { instagram: 'https://instagram.com.evil.test/afzal' },
    { tiktok: 'https://example.com/@afzal' },
    { youtube: 'https://youtube.com.evil.test/video' },
    { website: 'javascript:alert(1)' },
    { website: `https://example.com/${'a'.repeat(260)}` },
    { whatsapp: '03001234567' },
  ])('rejects unsafe or invalid social input %p', (socialLinks) => {
    expect(storeSocialLinksSchema.safeParse(socialLinks).success).toBe(false);
  });

  it('normalizes empty optional fields and rejects invalid category IDs', () => {
    expect(updateSellerProfileSchema.parse({ city: ' ', socialLinks: { instagram: '' } })).toMatchObject({ city: null, socialLinks: { instagram: null } });
    expect(updateSellerProfileSchema.safeParse({ storeCategoryId: '0' }).success).toBe(false);
    expect(createStoreSchema.safeParse({ storeName: 'A', jazzcashAccountNumber: '123', storeCategoryId: '9999999999999999999' }).success).toBe(false);
  });
});

describe('F21 store profile persistence and exposure', () => {
  it('updates category, city, and links without changing other seller fields', async () => {
    await updateSellerProfile(user.publicId, updateSellerProfileSchema.parse({
      storeCategoryId: '3', city: 'Islamabad', socialLinks: { instagram: 'https://instagram.com/afzal' },
    }));
    expect(categoryFind).toHaveBeenCalledWith({ where: { categoryId: 3n }, select: { categoryId: true } });
    expect(sellerUpdate.mock.calls[0][0].data).toEqual({
      storeCategoryId: 3n,
      city: 'Islamabad',
      socialLinks: { facebook: 'https://www.facebook.com/afzal', whatsapp: '+923001234567', instagram: 'https://instagram.com/afzal' },
    });
  });

  it('rejects a nonexistent category before modifying the seller', async () => {
    categoryFind.mockResolvedValueOnce(null);
    await expect(updateSellerProfile(user.publicId, { storeCategoryId: '99' })).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
    expect(sellerUpdate).not.toHaveBeenCalled();
  });

  it('serializes category, city, member date, and safe WhatsApp link for the public store', async () => {
    const result = await getPublicStorefront(seller.storeSlug);
    expect(result.store).toMatchObject({
      category: { id: '3', slug: 'clothing' }, city: 'Lahore',
      memberSince: '2026-01-01T00:00:00.000Z',
      socialLinks: { whatsapp: 'https://wa.me/923001234567' },
    });
    expect(publicSocialLinks(seller.socialLinks).whatsapp).toBe('https://wa.me/923001234567');
  });

  it('returns normalized store fields in the seller profile', async () => {
    expect(await getMyProfile(user.publicId)).toMatchObject({
      storeCategory: { id: '3' }, city: 'Lahore', socialLinks: { whatsapp: '+923001234567' },
    });
  });

  it('removes an explicitly cleared link while preserving other links', () => {
    expect(mergeSocialLinks(seller.socialLinks, { facebook: null })).toEqual({ whatsapp: '+923001234567' });
  });

  it('rejects buyer access to the seller profile update route middleware', () => {
    const next = jest.fn();
    authorize('SELLER')({ user: { sub: 'buyer', role: 'BUYER', jti: 't' } } as Request, {} as Response, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });
});
