import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError } from '../../core/errors/AppError';

// Task 1.2/1.3 — every admin/* router already applies `authenticate, authorize('ADMIN',
// 'SUPPORT')` at the router level (same pattern Feature 10's admin/returns router established),
// so by the time this middleware runs, req.user is guaranteed to be ADMIN or SUPPORT. This is
// the write-only half of that split: mutating routes additionally require ADMIN specifically,
// with a distinct error code (ADMIN_WRITE_REQUIRED) from the generic FORBIDDEN a Buyer/Seller
// gets for being blocked from the surface entirely — App Flow's Support role needs to tell "you
// can't do this at all" apart from "you can see this, but only Admin can act."
export function requireAdminWrite(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    next(new ForbiddenError('This action requires the Admin role — Support is read-only', undefined, 'ADMIN_WRITE_REQUIRED'));
    return;
  }
  next();
}
