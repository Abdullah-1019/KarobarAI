import { blindIndex, otpPepperedHash } from '../../src/core/crypto/fieldCipher';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import * as otp from '../../src/modules/auth/auth.otp';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => {
  await resetDb();
  await resetRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('auth.otp', () => {
  const phoneBidx = blindIndex('+923001111111');

  it('issues a 6-digit code and verifies it correctly, single-use', async () => {
    const { code } = await otp.issueOtp('register', phoneBidx);
    expect(code).toMatch(/^\d{6}$/);

    const first = await otp.verifyOtp('register', phoneBidx, code);
    expect(first).toBe('ok');

    // Same code cannot be reused.
    const second = await otp.verifyOtp('register', phoneBidx, code);
    expect(second).toBe('expired');
  });

  it('reports "incorrect" for a wrong code and preserves the real code for retry', async () => {
    const { code } = await otp.issueOtp('register', phoneBidx);

    const wrong = await otp.verifyOtp('register', phoneBidx, '000000');
    expect(wrong === 'incorrect' || code === '000000').toBe(true);

    const right = await otp.verifyOtp('register', phoneBidx, code);
    expect(right).toBe('ok');
  });

  it('reports "expired" once the code key is gone', async () => {
    await otp.issueOtp('register', phoneBidx);
    // Directly clear the underlying key to simulate TTL expiry without waiting 10 minutes.
    await redis.del(`otp:register:${phoneBidx}:code`);

    const result = await otp.verifyOtp('register', phoneBidx, '123456');
    expect(result).toBe('expired');
  });

  it('locks out after 5 wrong attempts against one code', async () => {
    const { code } = await otp.issueOtp('register', phoneBidx);

    let lastResult;
    for (let i = 0; i < 5; i += 1) {
      lastResult = await otp.verifyOtp('register', phoneBidx, '000001');
    }

    expect(lastResult).toBe('max_attempts');
    // Even the real code no longer works once max attempts is hit.
    const afterLockout = await otp.verifyOtp('register', phoneBidx, code);
    expect(afterLockout).toBe('max_attempts');
  });

  it('blocks the 6th resend within the 1-hour window', async () => {
    for (let i = 0; i < 5; i += 1) {
      await otp.issueOtp('register', phoneBidx);
    }

    await expect(otp.issueOtp('register', phoneBidx)).rejects.toMatchObject({
      code: 'OTP_RESEND_LIMIT',
      statusCode: 429,
    });
  });

  it('stores the code as a peppered hash, never plaintext', async () => {
    const { code } = await otp.issueOtp('register', phoneBidx);
    const stored = await redis.get(`otp:register:${phoneBidx}:code`);

    expect(stored).not.toBe(code);
    expect(stored).toBe(otpPepperedHash(code));
  });
});
