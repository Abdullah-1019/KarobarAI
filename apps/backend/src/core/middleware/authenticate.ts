import type { UserRole } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';

import { verifyAccessToken } from '../jwt';
import { AuthError } from '../errors/AppError';
import { redis } from '../redis';

export interface AuthPrincipal {
  sub: string;
  role: UserRole;
  jti: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPrincipal;
    }
  }
}

// Verifies the RS256 signature, then checks both denylist mechanisms (TRD §7 session
// invalidation) via a single Redis MGET: `denylist:jti:<jti>` for a single revoked session
// (logout, superseded refresh rotation), `denylist:user:<sub>` for a mass revocation (password
// reset, future admin suspend/ban) — a token minted before that revocation is rejected even if
// it hasn't naturally expired yet.
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AuthError());
    return;
  }

  const token = header.slice('Bearer '.length);

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch {
    next(new AuthError('Invalid or expired token'));
    return;
  }

  const [jtiDenied, userDeniedSince] = await redis.mget(
    `denylist:jti:${claims.jti}`,
    `denylist:user:${claims.sub}`,
  );

  if (jtiDenied) {
    next(new AuthError('Session revoked'));
    return;
  }

  if (userDeniedSince && claims.iat * 1000 <= Number(userDeniedSince)) {
    next(new AuthError('Session revoked'));
    return;
  }

  req.user = { sub: claims.sub, role: claims.role, jti: claims.jti };
  next();
}
