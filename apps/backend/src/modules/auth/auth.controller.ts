import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';

import { config } from '../../core/config';
import { AuthError, RateLimitError, ValidationError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import type {
  ForgotPasswordInput,
  LoginInput,
  OtpResendInput,
  OtpVerifyInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.dto';
import * as authService from './auth.service';
import { REFRESH_COOKIE_NAME, type RefreshMeta } from './auth.tokens';

function requestMeta(req: Request): RefreshMeta {
  return {
    userAgent: req.headers['user-agent'],
    ipHash: createHash('sha256').update(req.ip ?? '').digest('hex'),
  };
}

function setRefreshCookie(
  res: Response,
  cookie: { name: string; value: string; maxAgeSeconds: number },
): void {
  res.cookie(cookie.name, cookie.value, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: cookie.maxAgeSeconds * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
}

export const registerHandler = asyncHandler(async (req, res) => {
  const input = req.body as RegisterInput;
  const result = await authService.register(input, requestMeta(req));

  if (result.kind === 'pending_verification') {
    res.status(202).json(ok({ status: 'PENDING_VERIFICATION' }));
    return;
  }

  setRefreshCookie(res, result.auth.refreshCookie);
  res.status(201).json(
    ok({
      accessToken: result.auth.accessToken,
      expiresIn: result.auth.expiresIn,
      user: result.auth.user,
    }),
  );
});

export const otpVerifyHandler = asyncHandler(async (req, res) => {
  const input = req.body as OtpVerifyInput;
  const outcome = await authService.verifyOtpAndActivate(input, requestMeta(req));

  if (outcome.kind === 'ok') {
    setRefreshCookie(res, outcome.auth.refreshCookie);
    res.status(200).json(
      ok({
        accessToken: outcome.auth.accessToken,
        expiresIn: outcome.auth.expiresIn,
        user: outcome.auth.user,
      }),
    );
    return;
  }

  if (outcome.kind === 'incorrect') {
    throw new ValidationError('Incorrect code', undefined, 'OTP_INCORRECT');
  }
  if (outcome.kind === 'expired') {
    throw new ValidationError('Code expired — request a new one', undefined, 'OTP_EXPIRED');
  }
  throw new RateLimitError('Too many incorrect attempts — request a new code', undefined, 'OTP_MAX_ATTEMPTS');
});

export const otpResendHandler = asyncHandler(async (req, res) => {
  const input = req.body as OtpResendInput;
  await authService.resendOtp(input);
  res.status(200).json(ok({ resent: true, expiresInSeconds: 600 }));
});

export const loginHandler = asyncHandler(async (req, res) => {
  const input = req.body as LoginInput;
  const auth = await authService.login(input, requestMeta(req));

  setRefreshCookie(res, auth.refreshCookie);
  res.status(200).json(ok({ accessToken: auth.accessToken, expiresIn: auth.expiresIn, user: auth.user }));
});

export const refreshHandler = asyncHandler(async (req, res) => {
  const cookieValue = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const outcome = await authService.refresh(cookieValue, requestMeta(req));

  if (outcome.kind !== 'ok') {
    clearRefreshCookie(res);
    throw new AuthError('Session expired — please log in again', undefined, 'SESSION_EXPIRED');
  }

  setRefreshCookie(res, outcome.auth.refreshCookie);
  res.status(200).json(ok({ accessToken: outcome.auth.accessToken, expiresIn: outcome.auth.expiresIn }));
});

// Idempotent — always 200, even if there was no valid session to revoke.
export const logoutHandler = asyncHandler(async (req, res) => {
  const cookieValue = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await authService.logout(cookieValue);
  clearRefreshCookie(res);
  res.status(200).json(ok({ loggedOut: true }));
});

// Always {sent:true} regardless of whether the identifier matched an account — no enumeration.
export const forgotPasswordHandler = asyncHandler(async (req, res) => {
  const input = req.body as ForgotPasswordInput;
  await authService.forgotPassword(input);
  res.status(200).json(ok({ sent: true }));
});

export const resetPasswordHandler = asyncHandler(async (req, res) => {
  const input = req.body as ResetPasswordInput;
  await authService.resetPassword(input);
  res.status(200).json(ok({ reset: true }));
});

// Requires `authenticate` — req.user is guaranteed set by the time this runs.
export const meHandler = asyncHandler(async (req, res) => {
  const result = await authService.me(req.user!.sub);
  res.status(200).json(ok(result));
});
