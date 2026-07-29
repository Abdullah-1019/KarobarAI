import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import { config } from '../../core/config';
import { REFRESH_COOKIE_NAME, type RefreshMeta } from '../../core/http/session';
import { prisma } from '../../core/prisma';
import { redis } from '../../core/redis';

// Refresh-token lifecycle (TRD §7). Refresh tokens are NOT JWTs — they're an opaque
// `<jti>.<secret>` pair so they're DB-lookupable without scanning (refresh_tokens.tokenHash
// stores sha256(secret), never the plaintext secret). Pure JWT sign/verify for the access token
// lives in core/jwt/index.ts; REFRESH_COOKIE_NAME/RefreshMeta live in core/http/session.ts (both
// re-exported here for this module's own callers) — this module owns everything that touches
// Postgres/Redis for the refresh-token lifecycle itself.
//
// `jti` on the access token is the associated refresh token's jti — it ties an access token to
// its session/refresh lineage, which is what makes the Redis denylist below actionable.

export { REFRESH_COOKIE_NAME, type RefreshMeta };

export interface IssuedRefresh {
  jti: string;
  cookieValue: string;
  expiresAt: Date;
}

function hashSecret(secret: Buffer): string {
  return createHash('sha256').update(secret).digest('hex');
}

function buildCookieValue(jti: string, secret: Buffer): string {
  return `${jti}.${secret.toString('base64url')}`;
}

// jti is always a randomUUID() by construction (issueRefreshToken) and the column is @db.Uuid —
// reject anything that isn't UUID-shaped here, before it ever reaches a Prisma query. Without
// this, a malformed cookie (e.g. "garbage.value") passes a literal "garbage" into a UUID-typed
// WHERE clause, which Postgres rejects as an invalid input syntax error — an unhandled 500, not
// the clean 401 a bad cookie should produce.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCookieValue(cookieValue: string): { jti: string; secret: Buffer } | null {
  const separatorIndex = cookieValue.indexOf('.');
  if (separatorIndex === -1) return null;

  const jti = cookieValue.slice(0, separatorIndex);
  const secretB64 = cookieValue.slice(separatorIndex + 1);
  if (!jti || !secretB64 || !UUID_PATTERN.test(jti)) return null;

  try {
    return { jti, secret: Buffer.from(secretB64, 'base64url') };
  } catch {
    return null;
  }
}

// Used by logout — only the jti is needed to revoke, no need for the full rotate/validate path.
export function extractJtiFromCookie(cookieValue: string): string | null {
  const parsed = parseCookieValue(cookieValue);
  return parsed ? parsed.jti : null;
}

export async function issueRefreshToken(userId: bigint, meta: RefreshMeta = {}): Promise<IssuedRefresh> {
  const jti = randomUUID();
  const secret = randomBytes(32);
  const expiresAt = new Date(Date.now() + config.jwt.refreshTtlSeconds * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      jti,
      tokenHash: hashSecret(secret),
      userAgent: meta.userAgent,
      ipHash: meta.ipHash,
      expiresAt,
    },
  });

  return { jti, cookieValue: buildCookieValue(jti, secret), expiresAt };
}

// Single-session revoke (logout, or the superseded session on rotation). Marks the DB row
// revoked AND denylists the jti in Redis for the remaining life of any access token that was
// minted under it — DB revocation alone wouldn't stop an already-issued, still-unexpired access
// token from working until it naturally expires.
export async function revokeRefreshToken(jti: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { jti, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await redis.set(`denylist:jti:${jti}`, '1', 'EX', config.jwt.accessTtlSeconds);
}

// Mass revocation (password reset, profile change-password; admin suspend/ban later) — kills
// every session for a user, including already-issued, still-unexpired access tokens
// (REQ-F-Auth006). Stored in milliseconds, compared against the access token's custom `iatMs`
// claim (core/jwt), not the standard `iat` — see core/middleware/authenticate.ts for why
// whole-second precision is too coarse in both directions for a revoke-then-reissue-in-the-
// same-request flow.
export async function revokeAllRefreshTokensForUser(userId: bigint, publicId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await redis.set(`denylist:user:${publicId}`, Date.now().toString(), 'EX', config.jwt.accessTtlSeconds + 60);
}

export type RotateResult =
  | { status: 'ok'; jti: string; cookieValue: string; expiresAt: Date; userId: bigint }
  | { status: 'invalid' }
  | { status: 'reused' };

export async function rotateRefreshToken(cookieValue: string, meta: RefreshMeta = {}): Promise<RotateResult> {
  const parsed = parseCookieValue(cookieValue);
  if (!parsed) return { status: 'invalid' };

  const row = await prisma.refreshToken.findUnique({ where: { jti: parsed.jti } });
  if (!row) return { status: 'invalid' };

  const expectedHash = Buffer.from(row.tokenHash, 'hex');
  const actualHash = Buffer.from(hashSecret(parsed.secret), 'hex');
  const hashesMatch =
    expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash);
  if (!hashesMatch) return { status: 'invalid' };

  if (row.revokedAt) {
    // This exact refresh token was already rotated away and is now being replayed — a theft
    // signal, not a benign race. Kill every session for this user, not just this one.
    const user = await prisma.user.findUnique({
      where: { userId: row.userId },
      select: { publicId: true },
    });
    if (user) await revokeAllRefreshTokensForUser(row.userId, user.publicId);
    return { status: 'reused' };
  }

  if (row.expiresAt < new Date()) return { status: 'invalid' };

  await revokeRefreshToken(row.jti);
  const next = await issueRefreshToken(row.userId, meta);

  return {
    status: 'ok',
    jti: next.jti,
    cookieValue: next.cookieValue,
    expiresAt: next.expiresAt,
    userId: row.userId,
  };
}
