import { RateLimitError } from '../../core/errors/AppError';
import { redis } from '../../core/redis';

// Login lockout (REQ-F-Auth007): 5 failures in 15 min -> 30-min lock (or cleared by password
// reset). Keyed on blindIndex(normalized identifier) — the same helper regardless of whether the
// login identifier was a phone or email, so it's one uniform bucket type per account.

const FAILS_WINDOW_SECONDS = 900; // 15 minutes
const FAILS_THRESHOLD = 5;
const LOCK_TTL_SECONDS = 1800; // 30 minutes

function failsKey(idBidx: string): string {
  return `lockout:${idBidx}:fails`;
}
function lockedKey(idBidx: string): string {
  return `lockout:${idBidx}:locked`;
}

// Throws RateLimitError (429, code ACCOUNT_LOCKED) if currently locked — callers should check
// this before attempting a credential comparison at all.
export async function assertNotLocked(idBidx: string): Promise<void> {
  const ttl = await redis.ttl(lockedKey(idBidx));
  if (ttl > 0) {
    throw new RateLimitError(
      'Too many failed login attempts — account temporarily locked',
      { retryAfterSeconds: ttl },
      'ACCOUNT_LOCKED',
    );
  }
}

// Call on every failed login (unknown identifier or wrong password — identical branch, no
// enumeration). Locks the account once the 5th failure lands within the still-live 15-min window.
export async function recordFailedAttempt(idBidx: string): Promise<void> {
  const key = failsKey(idBidx);
  const fails = await redis.incr(key);
  if (fails === 1) {
    await redis.expire(key, FAILS_WINDOW_SECONDS);
  }
  if (fails >= FAILS_THRESHOLD) {
    await redis.set(lockedKey(idBidx), '1', 'EX', LOCK_TTL_SECONDS);
  }
}

// Call on successful login, and on successful password reset (REQ-F-Auth007's "or cleared by
// reset").
export async function clearLockout(idBidx: string): Promise<void> {
  await redis.del(failsKey(idBidx), lockedKey(idBidx));
}
