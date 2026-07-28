import bcrypt from 'bcrypt';
import request from 'supertest';

import { config } from '../../src/core/config';
import { blindIndex, encryptField, normalizeEmail } from '../../src/core/crypto/fieldCipher';
import { prisma } from '../../src/core/prisma';
import { app } from '../../src/server';
import { resetDb, resetRedis } from '../helpers/reset';

async function createActiveUser(overrides: { email: string; password: string; role?: 'BUYER' | 'SELLER' }) {
  const passwordHash = await bcrypt.hash(overrides.password, config.bcryptCost);
  const normalized = normalizeEmail(overrides.email);

  return prisma.user.create({
    data: {
      email: encryptField(normalized),
      emailBidx: blindIndex(normalized),
      passwordHash,
      role: overrides.role ?? 'BUYER',
      status: 'ACTIVE',
    },
  });
}

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/login', () => {
  it('logs in successfully with correct credentials', async () => {
    await createActiveUser({ email: 'login@example.com', password: 'Correct1$Pass' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'login@example.com', password: 'Correct1$Pass' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.headers['set-cookie']?.[0]).toMatch(/karobarai_rt=/);
  });

  it('returns identical error bodies for unknown identifier vs wrong password (no enumeration)', async () => {
    await createActiveUser({ email: 'known@example.com', password: 'Correct1$Pass' });

    const unknownRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'unknown@example.com', password: 'whatever1$X' });
    const wrongPassRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'known@example.com', password: 'WrongPass1$' });

    expect(unknownRes.status).toBe(401);
    expect(wrongPassRes.status).toBe(401);
    expect(unknownRes.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassRes.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownRes.body.error.message).toBe(wrongPassRes.body.error.message);
  });

  it('rejects a suspended account with 403 ACCOUNT_SUSPENDED', async () => {
    const user = await createActiveUser({ email: 'suspended@example.com', password: 'Correct1$Pass' });
    await prisma.user.update({ where: { userId: user.userId }, data: { status: 'SUSPENDED' } });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'suspended@example.com', password: 'Correct1$Pass' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('rejects an unverified (PENDING_VERIFICATION) account with 403 ACCOUNT_NOT_VERIFIED', async () => {
    const user = await createActiveUser({ email: 'pending@example.com', password: 'Correct1$Pass' });
    await prisma.user.update({ where: { userId: user.userId }, data: { status: 'PENDING_VERIFICATION' } });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'pending@example.com', password: 'Correct1$Pass' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
  });

  it('locks the account after 5 failed attempts within 15 minutes', async () => {
    await createActiveUser({ email: 'locktest@example.com', password: 'Correct1$Pass' });

    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: 'locktest@example.com', password: 'wrong-pass-1$' });
    }

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'locktest@example.com', password: 'Correct1$Pass' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});
