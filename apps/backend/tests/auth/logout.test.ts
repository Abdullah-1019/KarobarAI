import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { app } from '../../src/server';
import { resetDb, resetRedis } from '../helpers/reset';

function cookieHeaderOnly(setCookie: string): string {
  return setCookie.split(';')[0];
}

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the session so the same access token is rejected on the very next request', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send({
      method: 'email',
      role: 'BUYER',
      email: 'logout@example.com',
      password: 'Correct1$Pass',
    });
    const accessToken = registerRes.body.data.accessToken;
    const cookie = cookieHeaderOnly(registerRes.headers['set-cookie'][0]);

    const meBefore = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meBefore.status).toBe(200);

    const logoutRes = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.data.loggedOut).toBe(true);

    // Proves the Redis jti denylist is doing the work, not just the cookie being cleared —
    // this is the SAME still-unexpired access token, sent again with an explicit header.
    const meAfter = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meAfter.status).toBe(401);
  });

  it('is idempotent — never hard-errors when called with no cookie at all', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.data.loggedOut).toBe(true);
  });
});
