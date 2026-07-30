import { CATALOG_ERROR_CODES, STORE_ERROR_CODES } from '@karobarai/shared';
import type { NextFunction, Request, Response } from 'express';

import { AuthError, BusinessRuleError, ForbiddenError } from '../errors/AppError';
import { prisma } from '../prisma';

// Feature 4 Task 1.4 — composes Feature 3's hasStore/status=ACTIVE guarantees into one reusable
// chain for every seller/products/* write route, rather than rebuilding either check. Always
// mounted after authenticate + authorize(['SELLER']) (TRD §8's chain order — cheap, in-memory
// checks before this DB read).
export interface SellerContext {
  userId: bigint;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sellerContext?: SellerContext;
    }
  }
}

export async function requireActiveSeller(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next(new AuthError());
    return;
  }

  const user = await prisma.user.findUnique({
    where: { publicId: req.user.sub },
    select: { userId: true, status: true, sellerProfile: { select: { onboardingCompletedAt: true } } },
  });

  if (!user) {
    next(new AuthError());
    return;
  }

  // Largely defensive (mirrors Feature 3 Task 6.4's reasoning): a suspended/banned account's
  // sessions are already revoked by Auth's mass-denylist mechanism, so this token would normally
  // never reach here — this check only matters for the propagation-delay window.
  if (user.status !== 'ACTIVE') {
    next(new ForbiddenError('Account is not active', undefined, CATALOG_ERROR_CODES.STORE_NOT_ACTIVE));
    return;
  }

  if (!user.sellerProfile?.onboardingCompletedAt) {
    next(
      new BusinessRuleError(
        'Complete store onboarding before managing products',
        undefined,
        STORE_ERROR_CODES.STORE_NOT_ONBOARDED,
      ),
    );
    return;
  }

  req.sellerContext = { userId: user.userId };
  next();
}
