import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';

import { AppError } from '../errors/AppError';
import { fail } from '../http/envelope';
import { logger } from '../logger';

// express.json() throws a plain SyntaxError (not one of our AppError classes) on malformed
// request bodies. That's a client mistake, not a server fault — it belongs at 400/
// VALIDATION_ERROR, not the generic 500 fallback below. body-parser tags these with
// status === 400 and a `body` property holding the raw text it failed to parse.
function isMalformedBodyError(err: unknown): err is SyntaxError & { status: number } {
  return (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status?: unknown }).status === 400 &&
    'body' in err
  );
}

// Central error middleware (TRD §14): typed errors -> envelope; no stack traces reach the client.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, path: req.path }, err.message);
    res.status(err.statusCode).json(fail(err.code, err.message, err.details));
    return;
  }

  if (isMalformedBodyError(err)) {
    logger.warn({ path: req.path }, 'Malformed JSON request body');
    res.status(400).json(fail('VALIDATION_ERROR', 'Malformed JSON in request body'));
    return;
  }

  // multer throws its own error class (not an AppError) when a multipart upload violates its
  // configured limits — same class of gap as the body-parser JSON case above: a client mistake,
  // not a server fault.
  if (err instanceof MulterError) {
    logger.warn({ code: err.code, path: req.path }, err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json(fail('AVATAR_TOO_LARGE', 'File is too large (max 10MB)'));
      return;
    }
    res.status(400).json(fail('VALIDATION_ERROR', err.message));
    return;
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json(fail('INTERNAL_ERROR', 'Something went wrong'));
}
