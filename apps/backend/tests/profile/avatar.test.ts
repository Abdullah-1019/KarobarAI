jest.mock('../../src/adapters/storage', () => ({ getStorageAdapter: jest.fn() }));

import request from 'supertest';

import { getStorageAdapter } from '../../src/adapters/storage';
import { config } from '../../src/core/config';
import { prisma } from '../../src/core/prisma';
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
});

// Minimal valid PNG magic-byte header, padded so it clears multer's field-size expectations.
const PNG_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0),
]);

describe('POST /api/v1/profile/me/avatar', () => {
  it('uploads a valid image and persists avatarUrl', async () => {
    const user = await createTestUser('BUYER');
    mockUpload.mockResolvedValue({
      key: 'avatars/x/y.png',
      url: 'mock://storage/avatars/x/y.png',
    });

    const res = await request(app)
      .post('/api/v1/profile/me/avatar')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .attach('avatar', PNG_BUFFER, 'avatar.png');

    expect(res.status).toBe(200);
    expect(res.body.data.avatarUrl).toBe('mock://storage/avatars/x/y.png');
    expect(mockUpload).toHaveBeenCalledTimes(1);

    const row = await prisma.user.findUniqueOrThrow({ where: { userId: user.userId } });
    expect(row.avatarUrl).toBe('mock://storage/avatars/x/y.png');
  });

  it('rejects a non-image file with 400 AVATAR_INVALID_FILE (magic-byte check, not just mimetype)', async () => {
    const user = await createTestUser('BUYER');

    const res = await request(app)
      .post('/api/v1/profile/me/avatar')
      .set('Authorization', `Bearer ${user.accessToken}`)
      // Sent with an image/png field name/mimetype, but the actual bytes are plain text —
      // proves the check is on content, not the client-supplied content-type.
      .attach('avatar', Buffer.from('this is not an image'), { filename: 'fake.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AVATAR_INVALID_FILE');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects an oversized file with 400 AVATAR_TOO_LARGE before it reaches the service', async () => {
    const user = await createTestUser('BUYER');
    const oversized = Buffer.concat([PNG_BUFFER, Buffer.alloc(11 * 1024 * 1024, 0)]);

    const res = await request(app)
      .post('/api/v1/profile/me/avatar')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .attach('avatar', oversized, 'avatar.png');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AVATAR_TOO_LARGE');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated uploads with 401', async () => {
    const res = await request(app).post('/api/v1/profile/me/avatar').attach('avatar', PNG_BUFFER, 'avatar.png');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/profile/me/avatar', () => {
  it('clears avatarUrl and best-effort deletes the previously stored object', async () => {
    const user = await createTestUser('BUYER');
    const previousUrl = `${config.storage.publicBaseUrl}/${config.storage.bucket}/avatars/x/old.png`;
    // Go through the real upload path first so the stored URL has the shape the service's
    // extractStorageKey() actually parses — a hand-set arbitrary URL wouldn't exercise the
    // delete path at all, it would just silently no-op.
    mockUpload.mockResolvedValue({ key: 'avatars/x/old.png', url: previousUrl });
    await request(app)
      .post('/api/v1/profile/me/avatar')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .attach('avatar', PNG_BUFFER, 'avatar.png');

    const res = await request(app)
      .delete('/api/v1/profile/me/avatar')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.avatarUrl).toBeNull();

    const row = await prisma.user.findUniqueOrThrow({ where: { userId: user.userId } });
    expect(row.avatarUrl).toBeNull();

    // Fire-and-forget delete is async relative to the response — give it a tick to run.
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockDelete).toHaveBeenCalledWith('avatars/x/old.png');
  });
});
