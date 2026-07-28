import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

import { ValidationError } from '../errors/AppError';

// Edge validation (TRD §9): rejects unknown fields (schemas use .strict()) and malformed bodies
// before they ever reach a service function.
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError('Validation failed', result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}
