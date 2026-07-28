import type { UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';

import { getEmailAdapter } from '../../adapters/email';
import { getSmsAdapter } from '../../adapters/sms';
import { blindIndex, encryptField, normalizeEmail, normalizePhone } from '../../core/crypto/fieldCipher';
import { AuthError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/AppError';
import { config } from '../../core/config';
import { signAccessToken } from '../../core/jwt';
import { prisma } from '../../core/prisma';
import { redis } from '../../core/redis';
import type {
  ForgotPasswordInput,
  LoginInput,
  OtpResendInput,
  OtpVerifyInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.dto';
import * as lockout from './auth.lockout';
import * as otp from './auth.otp';
import {
  REFRESH_COOKIE_NAME,
  extractJtiFromCookie,
  issueRefreshToken,
  revokeAllRefreshTokensForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  type RefreshMeta,
} from './auth.tokens';

// Precomputed once at module load so bcrypt.compare against an "unknown identifier" login
// attempt takes the same time as a real comparison would — flattens the timing side-channel
// that would otherwise let an attacker distinguish "no such account" from "wrong password".
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('no-such-user-timing-safety', config.bcryptCost);

const RESET_TOKEN_TTL_SECONDS = 1800; // 30 minutes

function resetTokenKey(tokenHash: string): string {
  return `resetpwd:token:${tokenHash}`;
}

export interface AuthTokensResult {
  accessToken: string;
  expiresIn: number;
  refreshCookie: { name: string; value: string; maxAgeSeconds: number };
  user: { id: string; role: UserRole; status: UserStatus; preferredLanguage: string };
}

async function issueAuthResult(userId: bigint, meta: RefreshMeta): Promise<AuthTokensResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { userId } });
  const refreshToken = await issueRefreshToken(userId, meta);
  const accessToken = signAccessToken(user.publicId, user.role, refreshToken.jti);

  return {
    accessToken,
    expiresIn: config.jwt.accessTtlSeconds,
    refreshCookie: {
      name: REFRESH_COOKIE_NAME,
      value: refreshToken.cookieValue,
      maxAgeSeconds: config.jwt.refreshTtlSeconds,
    },
    user: {
      id: user.publicId,
      role: user.role,
      status: user.status,
      preferredLanguage: user.preferredLanguage,
    },
  };
}

interface ActivatingUser {
  userId: bigint;
  publicId: string;
}

// Flips a PENDING_VERIFICATION account to ACTIVE and creates the role-appropriate profile row.
//
// SellerProfile is created here — NOT deferred to the (out-of-scope) store-setup wizard — with a
// placeholder storeName and onboardingStep: 0. CONTRACT (see docs/handoffs/HO-F1-Auth.md): the
// future Store Management feature's first job on a seller login is to check
// `sellerProfile.onboardingCompletedAt === null` and redirect into the setup wizard rather than
// the dashboard. Do not treat a placeholder storeName as a "real" store.
async function activateUser(user: ActivatingUser, role: UserRole): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { userId: user.userId }, data: { status: 'ACTIVE' } });

    if (role === 'BUYER') {
      await tx.buyerProfile.upsert({
        where: { userId: user.userId },
        update: {},
        create: { userId: user.userId },
      });
    } else if (role === 'SELLER') {
      await tx.sellerProfile.upsert({
        where: { userId: user.userId },
        update: {},
        create: {
          userId: user.userId,
          storeName: `Seller-${user.publicId.slice(0, 8)}`,
          onboardingStep: 0,
        },
      });
    }
  });
}

export type RegisterResult =
  | { kind: 'pending_verification' }
  | { kind: 'active'; auth: AuthTokensResult };

export async function register(input: RegisterInput, meta: RefreshMeta): Promise<RegisterResult> {
  const passwordHash = await bcrypt.hash(input.password, config.bcryptCost);

  if (input.method === 'mobile') {
    const normalizedPhone = normalizePhone(input.phone);
    const phoneBidx = blindIndex(normalizedPhone);

    const existing = await prisma.user.findFirst({ where: { phoneBidx, deletedAt: null } });

    if (existing && existing.status !== 'PENDING_VERIFICATION') {
      throw new ConflictError(
        'An account with this phone number already exists — log in instead',
        undefined,
        'ACCOUNT_EXISTS',
      );
    }

    if (!existing) {
      await prisma.user.create({
        data: {
          phone: encryptField(normalizedPhone),
          phoneBidx,
          passwordHash,
          role: input.role,
          preferredLanguage: input.preferredLanguage ?? 'UR',
          status: 'PENDING_VERIFICATION',
        },
      });
    }

    const { code } = await otp.issueOtp('register', phoneBidx);
    await getSmsAdapter().sendSms(
      normalizedPhone,
      'otp_code',
      { code, ttlMinutes: 10 },
      input.preferredLanguage ?? 'UR',
    );

    return { kind: 'pending_verification' };
  }

  // method === 'email' — skips verification entirely (explicit decision: PRD only mandates OTP
  // verification for mobile, REQ-F-Auth001; no REQ-ID/mechanism specified for email).
  const normalizedEmail = normalizeEmail(input.email);
  const emailBidx = blindIndex(normalizedEmail);

  const existing = await prisma.user.findFirst({ where: { emailBidx, deletedAt: null } });
  if (existing) {
    throw new ConflictError(
      'An account with this email already exists — log in instead',
      undefined,
      'ACCOUNT_EXISTS',
    );
  }

  const created = await prisma.user.create({
    data: {
      email: encryptField(normalizedEmail),
      emailBidx,
      passwordHash,
      role: input.role,
      preferredLanguage: input.preferredLanguage ?? 'UR',
      status: 'PENDING_VERIFICATION', // flipped to ACTIVE by activateUser immediately below
    },
  });

  await activateUser({ userId: created.userId, publicId: created.publicId }, input.role);
  const auth = await issueAuthResult(created.userId, meta);

  return { kind: 'active', auth };
}

export type OtpVerifyOutcome =
  | { kind: 'ok'; auth: AuthTokensResult }
  | { kind: 'incorrect' }
  | { kind: 'expired' }
  | { kind: 'max_attempts' };

export async function verifyOtpAndActivate(
  input: OtpVerifyInput,
  meta: RefreshMeta,
): Promise<OtpVerifyOutcome> {
  const normalizedPhone = normalizePhone(input.phone);
  const phoneBidx = blindIndex(normalizedPhone);

  const result = await otp.verifyOtp('register', phoneBidx, input.code);
  if (result !== 'ok') {
    return { kind: result };
  }

  const user = await prisma.user.findFirst({ where: { phoneBidx, deletedAt: null } });
  if (!user) {
    throw new NotFoundError('Account not found', undefined, 'ACCOUNT_NOT_FOUND');
  }

  await activateUser({ userId: user.userId, publicId: user.publicId }, user.role);
  const auth = await issueAuthResult(user.userId, meta);

  return { kind: 'ok', auth };
}

export async function resendOtp(input: OtpResendInput): Promise<void> {
  const normalizedPhone = normalizePhone(input.phone);
  const phoneBidx = blindIndex(normalizedPhone);

  const { code } = await otp.issueOtp('register', phoneBidx);
  await getSmsAdapter().sendSms(normalizedPhone, 'otp_code', { code, ttlMinutes: 10 }, 'UR');
}

export async function login(input: LoginInput, meta: RefreshMeta): Promise<AuthTokensResult> {
  const isEmail = input.identifier.includes('@');
  const normalizedIdentifier = isEmail
    ? normalizeEmail(input.identifier)
    : normalizePhone(input.identifier);
  const idBidx = blindIndex(normalizedIdentifier);

  await lockout.assertNotLocked(idBidx);

  const user = isEmail
    ? await prisma.user.findFirst({ where: { emailBidx: idBidx, deletedAt: null } })
    : await prisma.user.findFirst({ where: { phoneBidx: idBidx, deletedAt: null } });

  // Compare against a real hash if found, otherwise a fixed dummy hash — same branch either way,
  // so timing doesn't reveal whether the identifier exists (App Flow SCR-A03: no enumeration).
  const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordOk) {
    await lockout.recordFailedAttempt(idBidx);
    throw new AuthError('Invalid credentials', undefined, 'INVALID_CREDENTIALS');
  }

  if (user.status === 'SUSPENDED' || user.status === 'BANNED' || user.status === 'DEACTIVATED') {
    throw new ForbiddenError('Account suspended — contact support', undefined, 'ACCOUNT_SUSPENDED');
  }
  if (user.status === 'PENDING_VERIFICATION') {
    throw new ForbiddenError('Account not verified yet', undefined, 'ACCOUNT_NOT_VERIFIED');
  }

  await lockout.clearLockout(idBidx);
  await prisma.user.update({ where: { userId: user.userId }, data: { lastLoginAt: new Date() } });

  return issueAuthResult(user.userId, meta);
}

export type RefreshOutcome =
  | { kind: 'ok'; auth: AuthTokensResult }
  | { kind: 'invalid' }
  | { kind: 'reused' };

export async function refresh(
  cookieValue: string | undefined,
  meta: RefreshMeta,
): Promise<RefreshOutcome> {
  if (!cookieValue) return { kind: 'invalid' };

  const result = await rotateRefreshToken(cookieValue, meta);
  if (result.status !== 'ok') {
    return { kind: result.status };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { userId: result.userId } });
  const accessToken = signAccessToken(user.publicId, user.role, result.jti);

  return {
    kind: 'ok',
    auth: {
      accessToken,
      expiresIn: config.jwt.accessTtlSeconds,
      refreshCookie: {
        name: REFRESH_COOKIE_NAME,
        value: result.cookieValue,
        maxAgeSeconds: config.jwt.refreshTtlSeconds,
      },
      user: {
        id: user.publicId,
        role: user.role,
        status: user.status,
        preferredLanguage: user.preferredLanguage,
      },
    },
  };
}

// Idempotent — never hard-errors, so a client can always call it safely on "log out" intent.
export async function logout(cookieValue: string | undefined): Promise<void> {
  if (!cookieValue) return;
  const jti = extractJtiFromCookie(cookieValue);
  if (!jti) return;
  await revokeRefreshToken(jti);
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<void> {
  const isEmail = input.identifier.includes('@');
  const normalized = isEmail ? normalizeEmail(input.identifier) : normalizePhone(input.identifier);
  const idBidx = blindIndex(normalized);

  const user = isEmail
    ? await prisma.user.findFirst({ where: { emailBidx: idBidx, deletedAt: null } })
    : await prisma.user.findFirst({ where: { phoneBidx: idBidx, deletedAt: null } });

  // Always behaves identically regardless of match — no enumeration, consistent with login.
  if (!user) return;

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await redis.set(resetTokenKey(tokenHash), user.userId.toString(), 'EX', RESET_TOKEN_TTL_SECONDS);

  if (isEmail) {
    await getEmailAdapter().sendEmail(
      normalized,
      'password_reset',
      { token, ttlMinutes: 30 },
      user.preferredLanguage,
    );
  } else {
    await getSmsAdapter().sendSms(
      normalized,
      'password_reset',
      { token, ttlMinutes: 30 },
      user.preferredLanguage,
    );
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = createHash('sha256').update(input.token).digest('hex');
  const userIdStr = await redis.getdel(resetTokenKey(tokenHash));

  if (!userIdStr) {
    throw new ValidationError(
      'Reset link is invalid or has expired — request a new one',
      undefined,
      'RESET_TOKEN_INVALID',
    );
  }

  const userId = BigInt(userIdStr);
  const passwordHash = await bcrypt.hash(input.newPassword, config.bcryptCost);
  const user = await prisma.user.update({ where: { userId }, data: { passwordHash } });

  // REQ-F-Auth007: reset clears lockout. Also revokes every active session/device — the
  // frontend must surface this explicitly (docs/handoffs/HO-F1-Auth.md), or it looks like a bug.
  if (user.phoneBidx) await lockout.clearLockout(user.phoneBidx);
  if (user.emailBidx) await lockout.clearLockout(user.emailBidx);
  await revokeAllRefreshTokensForUser(user.userId, user.publicId);
}

export interface MeResult {
  id: string;
  role: UserRole;
  status: UserStatus;
  preferredLanguage: string;
  createdAt: Date;
}

export async function me(publicId: string): Promise<MeResult> {
  const user = await prisma.user.findUnique({ where: { publicId } });
  if (!user) throw new AuthError();

  return {
    id: user.publicId,
    role: user.role,
    status: user.status,
    preferredLanguage: user.preferredLanguage,
    createdAt: user.createdAt,
  };
}
