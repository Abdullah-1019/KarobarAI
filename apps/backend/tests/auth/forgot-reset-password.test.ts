jest.mock('../../src/adapters/sms', () => ({ getSmsAdapter: jest.fn() }));
jest.mock('../../src/adapters/email', () => ({ getEmailAdapter: jest.fn() }));

import bcrypt from 'bcrypt';
import request from 'supertest';

import { getEmailAdapter } from '../../src/adapters/email';
import { getSmsAdapter } from '../../src/adapters/sms';
import { config } from '../../src/core/config';
import { blindIndex, encryptField, normalizeEmail } from '../../src/core/crypto/fieldCipher';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { resetDb, resetRedis } from '../helpers/reset';

const mockSendEmail = jest.fn().mockResolvedValue(undefined);
const mockSendSms = jest.fn().mockResolvedValue(undefined);

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  mockSendEmail.mockClear();
  mockSendSms.mockClear();
  (getEmailAdapter as jest.Mock).mockReturnValue({ sendEmail: mockSendEmail });
  (getSmsAdapter as jest.Mock).mockReturnValue({ sendSms: mockSendSms });
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

async function createActiveUser(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, config.bcryptCost);
  const normalized = normalizeEmail(email);

  return prisma.user.create({
    data: {
      email: encryptField(normalized),
      emailBidx: blindIndex(normalized),
      passwordHash,
      role: 'BUYER',
      status: 'ACTIVE',
    },
  });
}

describe('forgot/reset password', () => {
  it('always returns {sent:true}, matched or not — no enumeration', async () => {
    await createActiveUser('exists@example.com', 'Correct1$Pass');

    const matched = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: 'exists@example.com' });
    const unmatched = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: 'nope@example.com' });

    expect(matched.status).toBe(200);
    expect(unmatched.status).toBe(200);
    expect(matched.body.data.sent).toBe(true);
    expect(unmatched.body.data.sent).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1); // only for the real match
  });

  it('resets the password, clears lockout, and revokes every active session', async () => {
    await createActiveUser('reset@example.com', 'OldPass1$X');

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'reset@example.com', password: 'OldPass1$X' });
    const accessToken = loginRes.body.data.accessToken;

    // Rack up a failed attempt so there's lockout state to prove gets cleared.
    await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'reset@example.com', password: 'wrong1$Pass' });

    await request(app).post('/api/v1/auth/forgot-password').send({ identifier: 'reset@example.com' });
    const token = mockSendEmail.mock.calls[0][2].token as string;

    const resetRes = await request(app).post('/api/v1/auth/reset-password').send({
      token,
      newPassword: 'NewPass1$Z',
      confirmPassword: 'NewPass1$Z',
    });
    expect(resetRes.status).toBe(200);

    // Old session (still-unexpired access token) is now revoked.
    const meAfter = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meAfter.status).toBe(401);

    // Old password no longer works; new password does; no lingering lockout (429).
    const loginOld = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'reset@example.com', password: 'OldPass1$X' });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'reset@example.com', password: 'NewPass1$Z' });
    expect(loginNew.status).toBe(200);
  });

  it('rejects an invalid/garbage reset token with 400 RESET_TOKEN_INVALID', async () => {
    const res = await request(app).post('/api/v1/auth/reset-password').send({
      token: 'not-a-real-token',
      newPassword: 'NewPass1$Z',
      confirmPassword: 'NewPass1$Z',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('rejects mismatched newPassword/confirmPassword with 400', async () => {
    const res = await request(app).post('/api/v1/auth/reset-password').send({
      token: 'whatever',
      newPassword: 'NewPass1$Z',
      confirmPassword: 'Different1$Z',
    });
    expect(res.status).toBe(400);
  });
});
