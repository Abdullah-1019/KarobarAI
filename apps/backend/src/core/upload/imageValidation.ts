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
