import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer, { MulterError } from 'multer';

import { config } from '../config';
import { ValidationError } from '../errors/AppError';

// Shared by every image-upload feature (avatar/logo/banner — Features 2/3 — and product images —
// Feature 4) — one validation path, not N copies (Feature 3 Task 4.1's generalization decision,
// applied backend-side too). Only the error codes differ per target, so each feature's
// already-shipped/documented codes stay stable.

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // Assumption: reuse REQ-F-Store001's 10MB
// accept-then-compress ceiling — no avatar/logo/banner/product-image-specific limit is defined
// anywhere in the docs.

const MAGIC_BYTE_CHECKS: Array<{ mime: string; check: (buf: Buffer) => boolean }> = [
  { mime: 'image/jpeg', check: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    check: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: 'image/webp',
    check: (b) =>
      b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

// Sec-012: server-side magic-byte validation — never trust the client-supplied mimetype.
function detectImageType(buffer: Buffer): string | null {
  return MAGIC_BYTE_CHECKS.find((entry) => entry.check(buffer))?.mime ?? null;
}

export function validateImageFile(
  file: { buffer: Buffer; size: number },
  tooLargeCode: string,
  invalidFileCode: string,
): string {
  if (file.size > IMAGE_MAX_BYTES) {
    throw new ValidationError('Image file is too large (max 10MB)', undefined, tooLargeCode);
  }
  const mimeType = detectImageType(file.buffer);
  if (!mimeType) {
    throw new ValidationError('File is not a valid JPEG, PNG, or WEBP image', undefined, invalidFileCode);
  }
  return mimeType;
}

export function extractStorageKey(url: string): string | null {
  const prefix = `${config.storage.publicBaseUrl}/${config.storage.bucket}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

// Bug fix (flagged twice, never fixed): every multer instance in the codebase capped `fileSize`
// at this exact same IMAGE_MAX_BYTES value that validateImageFile() above also checks — so
// multer's own limit always rejected an oversized file first, before the request body ever
// reached a route handler and validateImageFile() got a chance to throw the correct per-feature
// code. The MulterError landed in the global errorHandler instead, which had no way to know
// which feature's route triggered it and hardcoded 'AVATAR_TOO_LARGE' for every case (correct
// only for the one route that's actually about avatars). Every other route's oversized-file
// error carried the wrong code — cosmetic (the 400 status was always correct), but misleading.
//
// Fixed by attaching the correct code to multer itself, at the exact call site that already
// knows it (every route already passes the right code to validateImageFile() a few lines below
// where it mounts multer — this reuses that same code, not a new one). The errorHandler's
// generic MulterError branch (core/middleware/errorHandler.ts) is now a pure defensive fallback
// for anything that isn't routed through these two factories, not the primary path.
const baseImageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: IMAGE_MAX_BYTES, files: 10 } });

// Multer's returned middleware is a plain (req, res, next) function — calling it directly
// (instead of handing it to Express's own dispatch) lets us supply our own `next`-shaped
// callback and intercept the LIMIT_FILE_SIZE case before Express's error-handling chain ever
// sees it.
function withTooLargeCode(middleware: RequestHandler, tooLargeCode: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err?: unknown) => {
      if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
        next(new ValidationError('Image file is too large (max 10MB)', undefined, tooLargeCode));
        return;
      }
      next(err);
    });
  };
}

export function singleImageUpload(field: string, tooLargeCode: string): RequestHandler {
  return withTooLargeCode(baseImageUpload.single(field), tooLargeCode);
}

export function arrayImageUpload(field: string, maxCount: number, tooLargeCode: string): RequestHandler {
  return withTooLargeCode(baseImageUpload.array(field, maxCount), tooLargeCode);
}
