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

// Error codes introduced by the User Profiles feature.
export const PROFILE_ERROR_CODES = {
  ADDRESS_NOT_FOUND: 'ADDRESS_NOT_FOUND',
  ADDRESS_NOT_OWNED: 'ADDRESS_NOT_OWNED',
  INVALID_CURRENT_PASSWORD: 'INVALID_CURRENT_PASSWORD',
  AVATAR_INVALID_FILE: 'AVATAR_INVALID_FILE',
  AVATAR_TOO_LARGE: 'AVATAR_TOO_LARGE',
} as const;

export type ProfileErrorCode = (typeof PROFILE_ERROR_CODES)[keyof typeof PROFILE_ERROR_CODES];
