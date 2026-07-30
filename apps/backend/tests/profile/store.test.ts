jest.mock('../../src/adapters/storage', () => ({ getStorageAdapter: jest.fn() }));

import request from 'supertest';

import { getStorageAdapter } from '../../src/adapters/storage';
import { config } from '../../src/core/config';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

const mockUpload = jest.fn();
const mockDelete = jest.fn().mockResolvedValue(undefined);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  mockUpload.mockReset();
  mockDelete.mockClear();
  (getStorageAdapter as jest.Mock).mockReturnValue({
    upload: mockUpload,
    delete: mockDelete,
    getUrl: (key: string) => `mock://storage/${key}`,
  });
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

// Minimal valid JPEG/PNG magic-byte headers, padded so they clear multer's field-size checks.
const JPEG_BUFFER = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0)]);
const PNG_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0),
]);

describe('POST /api/v1/profile/me/store (Task 2 — Create Store / complete onboarding)', () => {
  it('completes onboarding: persists store fields, sets hasStore true, creates payout wallet(s)', async () => {
    const seller = await createTestUser('SELLER'); // onboarded defaults to false

    const res = await request(app)
      .post('/api/v1/profile/me/store')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({
        storeName: 'My Real Store',
        storeDescription: 'We sell things',
        jazzcashAccountNumber: '03001234567',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.storeName).toBe('My Real Store');
    expect(res.body.data.hasStore).toBe(true);

    const row = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });
    expect(row.onboardingCompletedAt).not.toBeNull();
    expect(row.onboardingStep).toBe(3);

    const wallets = await prisma.payoutWallet.findMany({ where: { sellerId: seller.userId } });
    expect(wallets).toHaveLength(1);
    expect(wallets[0]?.type).toBe('JAZZCASH');
    expect(wallets[0]?.isDefault).toBe(true);
    // account_number must be encrypted at rest (Schema §14.1) — never the raw plaintext.
    expect(wallets[0]?.accountNumber).not.toBe('03001234567');
    expect(wallets[0]?.accountNumber.startsWith('v1:')).toBe(true);
  });

  it('accepts both wallets, marking the first (jazzcash) as default', async () => {
    const seller = await createTestUser('SELLER');

    const res = await request(app)
      .post('/api/v1/profile/me/store')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({
        storeName: 'Two Wallets Store',
        jazzcashAccountNumber: '03001234567',
        easypaisaAccountNumber: '03019876543',
      });

    expect(res.status).toBe(201);
    const wallets = await prisma.payoutWallet.findMany({
      where: { sellerId: seller.userId },
      orderBy: { walletId: 'asc' },
    });
    expect(wallets).toHaveLength(2);
    expect(wallets[0]?.type).toBe('JAZZCASH');
    expect(wallets[0]?.isDefault).toBe(true);
    expect(wallets[1]?.type).toBe('EASYPAISA');
    expect(wallets[1]?.isDefault).toBe(false);
  });

  it('rejects a payload with neither wallet field, 400 (REQ-F-Auth005: at least one required)', async () => {
    const seller = await createTestUser('SELLER');

    const res = await request(app)
      .post('/api/v1/profile/me/store')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ storeName: 'No Wallets' });

    expect(res.status).toBe(400);
  });

  it('rejects a second onboarding attempt with 409 ONBOARDING_ALREADY_COMPLETE (sequential double-submit)', async () => {
    const seller = await createTestUser('SELLER');
    const payload = { storeName: 'First', jazzcashAccountNumber: '03001234567' };

    const first = await request(app)
      .post('/api/v1/profile/me/store')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send(payload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/profile/me/store')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ storeName: 'Second Attempt', jazzcashAccountNumber: '03009999999' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ONBOARDING_ALREADY_COMPLETE');

    // The first, legitimate completion must be untouched by the rejected second attempt.
    const row = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });
    expect(row.storeName).toBe('First');
  });

  // Task 7.2 — proves the guarded-UPDATE race-safety design actually holds under real
  // concurrency, not just sequential double-submits (Promise.all, not sequential awaits).
  it('under concurrent double-submit, exactly one request succeeds and exactly one wallet set is created', async () => {
    const seller = await createTestUser('SELLER');

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/v1/profile/me/store')
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .send({ storeName: 'Race A', jazzcashAccountNumber: '03001111111' }),
      request(app)
        .post('/api/v1/profile/me/store')
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .send({ storeName: 'Race B', jazzcashAccountNumber: '03002222222' }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const wallets = await prisma.payoutWallet.findMany({ where: { sellerId: seller.userId } });
    expect(wallets).toHaveLength(1);
  });

  it('rejects a Buyer with 403 (seller-only)', async () => {
    const buyer = await createTestUser('BUYER');
    const res = await request(app)
      .post('/api/v1/profile/me/store')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ storeName: 'Nope', jazzcashAccountNumber: '03001234567' });
    expect(res.status).toBe(403);
  });
});

describe('POST/DELETE /api/v1/profile/me/store/logo', () => {
  it('uploads a logo for an onboarded seller and persists logoUrl', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    mockUpload.mockResolvedValue({
      key: 'store-logos/x/y.jpg',
      url: 'mock://storage/store-logos/x/y.jpg',
    });

    const res = await request(app)
      .post('/api/v1/profile/me/store/logo')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('logo', JPEG_BUFFER, 'logo.jpg');

    expect(res.status).toBe(200);
    expect(res.body.data.logoUrl).toBe('mock://storage/store-logos/x/y.jpg');

    const row = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });
    expect(row.logoUrl).toBe('mock://storage/store-logos/x/y.jpg');
  });

  it('rejects a non-image file with 400 STORE_IMAGE_INVALID_FILE', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });

    const res = await request(app)
      .post('/api/v1/profile/me/store/logo')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('logo', Buffer.from('not an image'), { filename: 'fake.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('STORE_IMAGE_INVALID_FILE');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('removes the logo and best-effort deletes the previously stored object', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const previousUrl = `${config.storage.publicBaseUrl}/${config.storage.bucket}/store-logos/x/old.jpg`;
    // extractStorageKey() (profile.service.ts) only recognizes URLs shaped with the real
    // configured publicBaseUrl/bucket prefix — an arbitrary mock:// URL wouldn't exercise the
    // delete path at all, it would just silently no-op (same gotcha avatar.test.ts avoids).
    mockUpload.mockResolvedValue({ key: 'store-logos/x/old.jpg', url: previousUrl });
    await request(app)
      .post('/api/v1/profile/me/store/logo')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('logo', JPEG_BUFFER, 'logo.jpg');

    const res = await request(app)
      .delete('/api/v1/profile/me/store/logo')
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.logoUrl).toBeNull();

    await new Promise((resolve) => setImmediate(resolve));
    expect(mockDelete).toHaveBeenCalledWith('store-logos/x/old.jpg');
  });
});

describe('POST/DELETE /api/v1/profile/me/store/banner', () => {
  it('uploads a banner for an onboarded seller and persists bannerUrl, independent of logoUrl', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    mockUpload.mockResolvedValue({
      key: 'store-banners/x/y.png',
      url: 'mock://storage/store-banners/x/y.png',
    });

    const res = await request(app)
      .post('/api/v1/profile/me/store/banner')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('banner', PNG_BUFFER, 'banner.png');

    expect(res.status).toBe(200);
    expect(res.body.data.bannerUrl).toBe('mock://storage/store-banners/x/y.png');
    expect(res.body.data.logoUrl).toBeNull();
  });

  it('removes the banner independently of the logo', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    mockUpload.mockResolvedValue({
      key: 'store-logos/x/logo.jpg',
      url: 'mock://storage/store-logos/x/logo.jpg',
    });
    await request(app)
      .post('/api/v1/profile/me/store/logo')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('logo', JPEG_BUFFER, 'logo.jpg');

    mockUpload.mockResolvedValue({
      key: 'store-banners/x/banner.png',
      url: 'mock://storage/store-banners/x/banner.png',
    });
    await request(app)
      .post('/api/v1/profile/me/store/banner')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .attach('banner', PNG_BUFFER, 'banner.png');

    const res = await request(app)
      .delete('/api/v1/profile/me/store/banner')
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.bannerUrl).toBeNull();
    // Removing the banner must never touch the logo — section isolation, same discipline as
    // Feature 2's per-section save pattern.
    expect(res.body.data.logoUrl).toBe('mock://storage/store-logos/x/logo.jpg');
  });
});

describe('GET /api/v1/profile/me/store/status (Task 6 — read-only, derived from users.status)', () => {
  it.each(['ACTIVE', 'SUSPENDED', 'BANNED', 'DEACTIVATED', 'PENDING_VERIFICATION'] as const)(
    'reflects users.status = %s',
    async (status) => {
      const seller = await createTestUser('SELLER', { onboarded: true });
      await prisma.user.update({ where: { userId: seller.userId }, data: { status } });

      const res = await request(app)
        .get('/api/v1/profile/me/store/status')
        .set('Authorization', `Bearer ${seller.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
      expect(res.body.data.since).toEqual(expect.any(String));
    },
  );
});
