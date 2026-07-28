import { randomInt } from 'node:crypto';

import { otpPepperedHash } from '../../core/crypto/fieldCipher';
import { RateLimitError } from '../../core/errors/AppError';
import { redis } from '../../core/redis';

// OTP lifecycle (REQ-F-Auth001, Sec-006): 6 digits, 10-min validity, single-use, max 5
// resends/hour. State lives entirely in Redis, never Postgres (Schema Doc §11) — keyed by
// phoneBidx (blind index), never the raw phone number.

const OTP_CODE_TTL_SECONDS = 600; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_TTL_SECONDS = 3600; // 1 hour, fixed window from first send
const OTP_RESEND_MAX = 5;

function codeKey(purpose: string, phoneBidx: string): string {
  return `otp:${purpose}:${phoneBidx}:code`;
}
function attemptsKey(purpose: string, phoneBidx: string): string {
  return `otp:${purpose}:${phoneBidx}:attempts`;
}
function resendKey(purpose: string, phoneBidx: string): string {
  return `otp:${purpose}:${phoneBidx}:resend_count`;
}

export interface IssuedOtp {
  code: string;
}

// Generates and stores a fresh code, enforcing the 5/hour resend cap. Throws RateLimitError
// (429) with details.retryAfterSeconds once the cap is hit — the caller (auth.service.ts) lets
// that propagate straight through the existing error middleware.
export async function issueOtp(purpose: string, phoneBidx: string): Promise<IssuedOtp> {
  const rKey = resendKey(purpose, phoneBidx);
  const resendCount = await redis.incr(rKey);
  if (resendCount === 1) {
    await redis.expire(rKey, OTP_RESEND_TTL_SECONDS);
  }
  if (resendCount > OTP_RESEND_MAX) {
    const ttl = await redis.ttl(rKey);
    throw new RateLimitError(
      'Too many OTP requests — try again later',
      { retryAfterSeconds: ttl > 0 ? ttl : OTP_RESEND_TTL_SECONDS },
      'OTP_RESEND_LIMIT',
    );
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await redis.set(codeKey(purpose, phoneBidx), otpPepperedHash(code), 'EX', OTP_CODE_TTL_SECONDS);
  await redis.del(attemptsKey(purpose, phoneBidx));

  return { code };
}

export type OtpVerifyResult = 'ok' | 'incorrect' | 'expired' | 'max_attempts';

// GETDEL makes a *correct* verification atomically single-use (two concurrent correct guesses
// can't both succeed — whichever loses the race sees the key already gone). A *wrong* guess
// restores the code (fresh TTL) so the user keeps their remaining attempts against one code,
// rather than being forced to resend after a single typo.
export async function verifyOtp(
  purpose: string,
  phoneBidx: string,
  code: string,
): Promise<OtpVerifyResult> {
  const cKey = codeKey(purpose, phoneBidx);
  const aKey = attemptsKey(purpose, phoneBidx);

  const attempts = Number((await redis.get(aKey)) ?? '0');
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(cKey, aKey);
    return 'max_attempts';
  }

  const storedHash = await redis.getdel(cKey);
  if (!storedHash) return 'expired';

  if (otpPepperedHash(code) !== storedHash) {
    const newAttempts = await redis.incr(aKey);
    if (newAttempts === 1) await redis.expire(aKey, OTP_CODE_TTL_SECONDS);

    if (newAttempts >= OTP_MAX_ATTEMPTS) {
      return 'max_attempts';
    }

    await redis.set(cKey, storedHash, 'EX', OTP_CODE_TTL_SECONDS);
    return 'incorrect';
  }

  await redis.del(aKey);
  return 'ok';
}
