// Stable, machine-readable error codes shared by api and web (TRD §9, §14). The frontend
// switches on `error.code` (not HTTP status or message text) for exact per-screen wording.
// Populated feature by feature — these are the codes the Auth feature introduces.

export const AUTH_ERROR_CODES = {
  ACCOUNT_EXISTS: 'ACCOUNT_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  OTP_INCORRECT: 'OTP_INCORRECT',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
  OTP_RESEND_LIMIT: 'OTP_RESEND_LIMIT',
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
