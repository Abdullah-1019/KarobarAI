import bcrypt from 'bcrypt';
import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestUser, issueSession } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('POST /api/v1/profile/me/password', () => {
  it('changes the password, revokes every other session, and reissues the current one', async () => {
    const user = await createTestUser('BUYER', { password: 'OldPass1$X' });
    // A second session for the SAME user — represents another logged-in device.
    const otherDevice = await issueSession(user, 'BUYER');

    const res = await request(app)
      .post('/api/v1/profile/me/password')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ currentPassword: 'OldPass1$X', newPassword: 'NewPass1$Z', confirmNewPassword: 'NewPass1$Z' });

    expect(res.status).toBe(200);
    const newAccessToken = res.body.data.accessToken;
    expect(newAccessToken).toEqual(expect.any(String));

    // The other device's session is now dead (mass revoke via denylist:user).
    const otherDeviceNow = await request(app)
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${otherDevice.accessToken}`);
    expect(otherDeviceNow.status).toBe(401);

    // The token used to MAKE the password-change request is also now dead — only the freshly
    // issued one continues working (no device is silently left on a stale-but-valid token).
    const oldTokenNow = await request(app)
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(oldTokenNow.status).toBe(401);

    const currentDeviceNow = await request(app)
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${newAccessToken}`);
    expect(currentDeviceNow.status).toBe(200);

    const row = await prisma.user.findUniqueOrThrow({ where: { userId: user.userId } });
    expect(await bcrypt.compare('NewPass1$Z', row.passwordHash!)).toBe(true);
    expect(await bcrypt.compare('OldPass1$X', row.passwordHash!)).toBe(false);
  });

  it('rejects an incorrect current password with 401 INVALID_CURRENT_PASSWORD', async () => {
    const user = await createTestUser('BUYER', { password: 'Correct1$Pass' });

    const res = await request(app)
      .post('/api/v1/profile/me/password')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ currentPassword: 'WrongPass1$X', newPassword: 'NewPass1$Z', confirmNewPassword: 'NewPass1$Z' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  it('rejects a weak new password with 400 — same rule as registration, imported not redefined', async () => {
    const user = await createTestUser('BUYER', { password: 'Correct1$Pass' });

    const res = await request(app)
      .post('/api/v1/profile/me/password')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ currentPassword: 'Correct1$Pass', newPassword: 'weak', confirmNewPassword: 'weak' });

    expect(res.status).toBe(400);
  });

  it('rejects mismatched newPassword/confirmNewPassword with 400', async () => {
    const user = await createTestUser('BUYER', { password: 'Correct1$Pass' });

    const res = await request(app)
      .post('/api/v1/profile/me/password')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ currentPassword: 'Correct1$Pass', newPassword: 'NewPass1$Z', confirmNewPassword: 'Different1$Z' });

    expect(res.status).toBe(400);
  });
});
