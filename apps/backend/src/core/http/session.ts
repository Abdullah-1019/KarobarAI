import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';

import { config } from '../config';

// Shared by any module that issues/rotates/clears the refresh-token cookie — currently
// modules/auth (login/register/refresh/logout) and modules/profile (change-password reissues a
// fresh pair for the current session). Lives in core/http, not modules/auth, so it can be
// consumed by other modules without a core->modules inversion; modules/auth/auth.tokens.ts
// re-exports REFRESH_COOKIE_NAME from here for its own callers.

export const REFRESH_COOKIE_NAME = 'karobarai_rt';

export interface RefreshMeta {
  userAgent?: string;
  ipHash?: string;
}

export function requestMeta(req: Request): RefreshMeta {
  return {
    userAgent: req.headers['user-agent'],
    ipHash: createHash('sha256').update(req.ip ?? '').digest('hex'),
  };
}

export function setRefreshCookie(
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

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
}
