import type { NextFunction, Request, Response } from 'express';

import { verifyAccessToken } from '../jwt';
import { redis } from '../redis';

// Feature 4 Task 3.6 — the public product-detail route needs to know "is the caller the owning
// Seller?" (to allow a Draft preview) without ever requiring a token. Same signature-verify +
// denylist logic as `authenticate`, but a missing/invalid/expired/revoked token just proceeds
// anonymously (req.user stays undefined) instead of ever rejecting with 401.
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const claims = verifyAccessToken(token);

    const [jtiDenied, userDeniedSince] = await redis.mget(
      `denylist:jti:${claims.jti}`,
      `denylist:user:${claims.sub}`,
    );

    if (jtiDenied) {
      next();
      return;
    }
    if (userDeniedSince && claims.iatMs < Number(userDeniedSince)) {
      next();
      return;
    }

    req.user = { sub: claims.sub, role: claims.role, jti: claims.jti };
  } catch {
    // Invalid/expired token on a public route — proceed as anonymous rather than erroring.
  }

  next();
}
