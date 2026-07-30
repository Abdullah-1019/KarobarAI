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

// Feature 4's first GET-with-params endpoints (search/autocomplete) — query strings arrive as
// plain strings (Zod's z.coerce.number() on the schema side handles numeric conversion).
export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError('Validation failed', result.error.flatten()));
      return;
    }
    req.query = result.data as typeof req.query;
    next();
  };
}
