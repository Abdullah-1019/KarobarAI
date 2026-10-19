import request from 'supertest';
import { randomUUID } from 'node:crypto';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('F21 store profile database and API', () => {
  it('restricts description generation to an authenticated, onboarded seller', async () => {
    const buyer = await createTestUser('BUYER');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const path = '/api/v1/profile/me/store/description-suggestion';
    expect((await request(app).post(path).send({})).status).toBe(401);
    expect((await request(app).post(path).set('Authorization', `Bearer ${buyer.accessToken}`).send({})).status).toBe(403);
    const insufficient = await request(app).post(path)
      .set('Authorization', `Bearer ${seller.accessToken}`).send({});
    expect(insufficient.status).toBe(422);
    expect(insufficient.body.error.code).toBe('STORE_DESCRIPTION_NEEDS_DETAILS');
  });

  it('saves bilingual descriptions through the seller profile and exposes them publicly', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const before = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });
    const response = await request(app).patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ storeDescription: 'A store selling clothing in Lahore.', storeDescriptionUr: 'لاہور میں کپڑوں کا اسٹور۔' });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      storeDescription: 'A store selling clothing in Lahore.',
      storeDescriptionUr: 'لاہور میں کپڑوں کا اسٹور۔',
    });
    const stored = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });
    expect(stored.storeName).toBe(before.storeName);
    expect(stored.storeCategoryId).toBe(before.storeCategoryId);
    const storefront = await request(app).get(`/api/v1/stores/${stored.storeSlug}`);
    expect(storefront.status).toBe(200);
    expect(storefront.body.data.store).toMatchObject({
      description: 'A store selling clothing in Lahore.',
      descriptionUr: 'لاہور میں کپڑوں کا اسٹور۔',
    });
  });

  it('saves optional category, city, and links during seller onboarding', async () => {
    const seller = await createTestUser('SELLER');
    const category = await prisma.category.create({
      data: { slug: `f21-setup-${randomUUID()}`, nameEn: 'Clothing', nameUr: 'Clothing' },
    });
    const response = await request(app).post('/api/v1/profile/me/store')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ storeName: 'F21 Store', jazzcashAccountNumber: '03001234567',
        storeCategoryId: category.categoryId.toString(), city: 'Karachi',
        socialLinks: { website: 'https://example.com/f21' },
      });
    expect(response.status).toBe(201);
    const stored = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });
    expect(stored.storeCategoryId).toBe(category.categoryId);
    expect(stored.city).toBe('Karachi');
    expect(stored.socialLinks).toMatchObject({ website: 'https://example.com/f21' });
  });

  it('persists category, city, links, and exposes safe public values', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const slug = `f21-clothing-${randomUUID()}`;
    const category = await prisma.category.create({ data: { slug, nameEn: 'Clothing', nameUr: 'Clothing' } });
    const before = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });

    const response = await request(app).patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ storeCategoryId: category.categoryId.toString(), city: 'Lahore', socialLinks: {
        instagram: 'https://www.instagram.com/f21store', whatsapp: '+923001234567',
      } });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ city: 'Lahore', storeCategory: { id: category.categoryId.toString() } });

    const stored = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });
    expect(stored.storeCategoryId).toBe(category.categoryId);
    expect(stored.city).toBe('Lahore');
    expect(stored.socialLinks).toMatchObject({ whatsapp: '+923001234567' });
    expect(stored.storeName).toBe(before.storeName);
    expect(stored.storeSlug).toBe(before.storeSlug);

    const publicResponse = await request(app).get(`/api/v1/stores/${stored.storeSlug}`);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.data.store).toMatchObject({
      city: 'Lahore', category: { id: category.categoryId.toString(), slug },
      socialLinks: { whatsapp: 'https://wa.me/923001234567' },
    });
  });

  it('rejects an unknown category and unsafe links without changing the store', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const missing = await request(app).patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ storeCategoryId: '9223372036854775807' });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('CATEGORY_NOT_FOUND');

    const invalid = await request(app).patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ socialLinks: { facebook: 'https://facebook.com.evil.test/store' } });
    expect(invalid.status).toBe(400);

    const stored = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });
    expect(stored.storeCategoryId).toBeNull();
    expect(stored.socialLinks).toEqual({});
  });

  it('forbids buyer updates to seller store fields', async () => {
    const buyer = await createTestUser('BUYER');
    const response = await request(app).patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ city: 'Lahore' });
    expect(response.status).toBe(403);
  });
});
