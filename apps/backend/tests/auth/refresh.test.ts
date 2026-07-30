import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { resetDb, resetRedis } from '../helpers/reset';

function cookieHeaderOnly(setCookie: string | undefined): string {
  if (!setCookie) throw new Error('Expected a Set-Cookie header but got none');
  return setCookie.split(';')[0]!;
}

async function registerEmailUser(email: string) {
  const res = await request(app).post('/api/v1/auth/register').send({
    method: 'email',
    role: 'BUYER',
    email,
    password: 'Correct1$Pass',
  });
  return { cookie: cookieHeaderOnly(res.headers['set-cookie']?.[0]) };
}

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('POST /api/v1/auth/refresh', () => {
  it('rotates the refresh cookie and issues a new access token', async () => {
    const { cookie } = await registerEmailUser('refresh1@example.com');

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    const newCookie = res.headers['set-cookie']?.[0];
    expect(newCookie).toMatch(/karobarai_rt=/);
    expect(cookieHeaderOnly(newCookie)).not.toBe(cookie);
  });

  it('detects reuse of a superseded refresh token and revokes every session for that user', async () => {
    const { cookie } = await registerEmailUser('refresh2@example.com');

    const firstRefresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    const newCookie = cookieHeaderOnly(firstRefresh.headers['set-cookie']?.[0]);

    // Replay the OLD (already-rotated) cookie — a theft signal.
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('SESSION_EXPIRED');

    // The NEW cookie issued by the first refresh should now ALSO be revoked (mass revoke).
    const afterReuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', newCookie);
    expect(afterReuse.status).toBe(401);
  });

  it('returns 401 for a missing or garbage cookie', async () => {
    const missing = await request(app).post('/api/v1/auth/refresh');
    expect(missing.status).toBe(401);

    const garbage = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'karobarai_rt=garbage.value');
    expect(garbage.status).toBe(401);
  });
});
