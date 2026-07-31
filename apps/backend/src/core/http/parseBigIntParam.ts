import { NotFoundError } from '../errors/AppError';

// A raw, garbage (non-numeric) route param passed straight to BigInt() throws a native
// SyntaxError that isn't one of our typed AppError classes — it would surface as an unhandled
// 500 instead of a clean 404. Same class of gap as auth.tokens.ts's UUID_PATTERN check before a
// malformed jti ever reaches a Postgres query.
export function parseBigIntParam(value: string | undefined, notFoundCode: string): bigint {
  if (!value || !/^\d+$/.test(value)) {
    throw new NotFoundError('Not found', undefined, notFoundCode);
  }
  return BigInt(value);
}
