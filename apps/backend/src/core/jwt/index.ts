import type { UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';

import { config } from '../config';

// Pure JWT sign/verify (TRD §7) — no Prisma/Redis dependency, so both
// core/middleware/authenticate.ts and modules/auth/auth.tokens.ts can depend on this without
// core/middleware ever having to import from modules/ (which would invert the intended
// core <- modules layering, TRD §12).

export interface AccessTokenClaims {
  sub: string; // user.publicId — never the internal BigInt userId
  role: UserRole;
  jti: string;
  iat: number;
  exp: number;
}

export function signAccessToken(sub: string, role: UserRole, jti: string): string {
  return jwt.sign({ role, jti }, config.jwt.privateKey, {
    algorithm: 'RS256',
    subject: sub,
    expiresIn: config.jwt.accessTtlSeconds,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, config.jwt.publicKey, {
    algorithms: ['RS256'],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });

  if (
    typeof decoded === 'string' ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.jti !== 'string' ||
    typeof decoded.role !== 'string' ||
    typeof decoded.iat !== 'number' ||
    typeof decoded.exp !== 'number'
  ) {
    throw new Error('Malformed access token payload');
  }

  return {
    sub: decoded.sub,
    role: decoded.role as UserRole,
    jti: decoded.jti,
    iat: decoded.iat,
    exp: decoded.exp,
  };
}
