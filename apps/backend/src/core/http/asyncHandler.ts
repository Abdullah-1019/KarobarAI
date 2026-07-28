import type { NextFunction, Request, Response } from 'express';

// Express doesn't forward rejected promises from async handlers to the error middleware on its
// own — wrap every async route handler with this so a thrown/rejected error still reaches
// core/middleware/errorHandler.ts instead of hanging the request or crashing the process.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
