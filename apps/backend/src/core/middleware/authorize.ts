import type { UserRole } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';

import { AuthError, ForbiddenError } from '../errors/AppError';

// Role gate — always composed after `authenticate` (TRD §8's authenticate -> authorize ->
// ownership chain). This split structurally guarantees the 401-vs-403 boundary App Flow's
// global UI states require: any token problem is 401 from `authenticate`; any role problem is
// 403 here, only ever reachable once a token was already valid.
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Not authorised for this action'));
      return;
    }
    next();
  };
}
