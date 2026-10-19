import axios from 'axios';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import {
  generateStoreDescription,
  generateStoreDescriptionSchema,
  parseStoreDescriptionSuggestion,
} from '../../src/modules/profile/store-description.service';

jest.mock('axios');
jest.mock('../../src/core/prisma', () => ({ prisma: { user: { findUnique: jest.fn() } } }));
jest.mock('../../src/core/redis', () => ({ redis: { set: jest.fn(), eval: jest.fn() } }));

const userFind = prisma.user.findUnique as jest.Mock;
const redisSet = redis.set as jest.Mock;
const redisEval = redis.eval as jest.Mock;
const aiPost = axios.post as jest.Mock;
const suggestion = {
  descriptionEn: 'Cloth Corner is a clothing store in Lahore. Explore its products.',
  descriptionUr: 'کلاتھ کارنر لاہور میں کپڑوں کا اسٹور ہے۔ یہاں مصنوعات دیکھیں۔',
};

beforeEach(() => {
  jest.clearAllMocks();
  userFind.mockResolvedValue({
    userId: 7n,
    sellerProfile: {
      onboardingCompletedAt: new Date(),
      storeName: 'Cloth Corner', city: 'Lahore',
      storeCategory: { nameEn: 'Clothing', nameUr: 'کپڑے' },
    },
  });
  redisSet.mockResolvedValue('OK');
  redisEval.mockResolvedValue(1);
  aiPost.mockResolvedValue({ data: suggestion });
});

it('returns both languages using only the authenticated seller store facts, without saving', async () => {
  const result = await generateStoreDescription('seller-public-id', { businessDetails: 'Handmade shirts' });
  expect(result).toEqual(suggestion);
  expect(userFind).toHaveBeenCalledWith(expect.objectContaining({ where: { publicId: 'seller-public-id' } }));
  expect(aiPost).toHaveBeenCalledWith(
    expect.stringContaining('/internal/generate-store-description'),
    { name: 'Cloth Corner', categoryEn: 'Clothing', categoryUr: 'کپڑے', city: 'Lahore', businessDetails: 'Handmade shirts' },
    expect.objectContaining({ timeout: expect.any(Number) }),
  );
  expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
});

it('requires enough seller facts and does not contact AI when insufficient', async () => {
  userFind.mockResolvedValueOnce({ userId: 7n, sellerProfile: { onboardingCompletedAt: new Date(), storeName: 'Name', storeCategory: null } });
  await expect(generateStoreDescription('seller-public-id', {})).rejects.toMatchObject({ code: 'STORE_DESCRIPTION_NEEDS_DETAILS' });
  expect(aiPost).not.toHaveBeenCalled();
});

it('requires an onboarded seller and rejects unknown accounts', async () => {
  userFind.mockResolvedValueOnce(null);
  await expect(generateStoreDescription('missing', {})).rejects.toMatchObject({ statusCode: 401 });
  userFind.mockResolvedValueOnce({ userId: 7n, sellerProfile: null });
  await expect(generateStoreDescription('seller-public-id', {})).rejects.toMatchObject({ code: 'STORE_NOT_ONBOARDED' });
  expect(aiPost).not.toHaveBeenCalled();
});

it('rejects malformed provider output and invalid Urdu', async () => {
  expect(parseStoreDescriptionSuggestion({ descriptionEn: 'English text longer than twenty chars', descriptionUr: 'No Urdu text longer than twenty chars' })).toBeNull();
  aiPost.mockResolvedValueOnce({ data: { reply: 'not structured' } });
  await expect(generateStoreDescription('seller-public-id', {})).rejects.toMatchObject({ code: 'STORE_DESCRIPTION_INVALID' });
});

it('returns safe errors for timeout, rate limit, and concurrent generation', async () => {
  aiPost.mockRejectedValueOnce({ code: 'ECONNABORTED' });
  await expect(generateStoreDescription('seller-public-id', {})).rejects.toMatchObject({ code: 'STORE_DESCRIPTION_UNAVAILABLE' });
  aiPost.mockRejectedValueOnce({ response: { status: 429 } });
  await expect(generateStoreDescription('seller-public-id', {})).rejects.toMatchObject({ code: 'STORE_DESCRIPTION_PROVIDER_RATE_LIMIT' });
  redisSet.mockResolvedValueOnce(null);
  await expect(generateStoreDescription('seller-public-id', {})).rejects.toMatchObject({ code: 'STORE_DESCRIPTION_IN_PROGRESS' });
});

it('limits repeated generation and validates seller-supplied input', async () => {
  redisEval.mockResolvedValueOnce(6);
  await expect(generateStoreDescription('seller-public-id', {})).rejects.toMatchObject({ code: 'STORE_DESCRIPTION_RATE_LIMIT' });
  expect(aiPost).not.toHaveBeenCalled();
  expect(generateStoreDescriptionSchema.safeParse({ businessDetails: 'x'.repeat(501) }).success).toBe(false);
  expect(generateStoreDescriptionSchema.safeParse({ arbitrary: 'input' }).success).toBe(false);
});
