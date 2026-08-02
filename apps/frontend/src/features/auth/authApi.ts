import type {
  ForgotPasswordInput,
  LoginInput,
  OtpResendInput,
  OtpVerifyInput,
  RegisterInput,
  ResetPasswordInput,
} from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';
import type { AuthUser } from '../../lib/authStore';

// Shapes mirror apps/backend/src/modules/auth/auth.controller.ts exactly (HO-F1-Auth.md).
export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

export type RegisterResult = { kind: 'pending_verification' } | { kind: 'active'; session: AuthSession };

export async function register(input: RegisterInput): Promise<RegisterResult> {
  const response = await apiClient.post<ApiEnvelope<AuthSession | { status: 'PENDING_VERIFICATION' }>>(
    '/auth/register',
    input,
  );
  if (response.status === 202) {
    return { kind: 'pending_verification' };
  }
  const session = await unwrap<AuthSession>(Promise.resolve(response as { data: ApiEnvelope<AuthSession> }));
  return { kind: 'active', session };
}

export function otpVerify(input: OtpVerifyInput): Promise<AuthSession> {
  return unwrap(apiClient.post<ApiEnvelope<AuthSession>>('/auth/otp/verify', input));
}

export function otpResend(input: OtpResendInput): Promise<{ resent: boolean; expiresInSeconds: number }> {
  return unwrap(apiClient.post<ApiEnvelope<{ resent: boolean; expiresInSeconds: number }>>('/auth/otp/resend', input));
}

export function login(input: LoginInput): Promise<AuthSession> {
  return unwrap(apiClient.post<ApiEnvelope<AuthSession>>('/auth/login', input));
}

// Always resolves { sent: true } regardless of whether the identifier matched an account — no
// enumeration, per HO-F1-Auth.md. There is no error state to handle here.
export function forgotPassword(input: ForgotPasswordInput): Promise<{ sent: boolean }> {
  return unwrap(apiClient.post<ApiEnvelope<{ sent: boolean }>>('/auth/forgot-password', input));
}

export function resetPassword(input: ResetPasswordInput): Promise<{ reset: boolean }> {
  return unwrap(apiClient.post<ApiEnvelope<{ reset: boolean }>>('/auth/reset-password', input));
}

// No body — the karobarai_rt HttpOnly cookie is sent automatically (apiClient has
// withCredentials: true). Returns only a new access token, not the user (HO-F1-Auth.md); callers
// that need `user` must follow up with me().
export function refresh(): Promise<{ accessToken: string; expiresIn: number }> {
  return unwrap(apiClient.post<ApiEnvelope<{ accessToken: string; expiresIn: number }>>('/auth/refresh'));
}

// Takes an explicit token during session bootstrap (before the store holds one, so the request
// interceptor has nothing to attach yet) — falls back to whatever's in the store otherwise.
export function me(token?: string): Promise<AuthUser> {
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  return unwrap(apiClient.get<ApiEnvelope<AuthUser>>('/auth/me', config));
}

// No frontend caller existed yet (no header/nav shell to put a logout action in until this
// feature adds one) — revokes the karobarai_rt cookie server-side; callers still need to clear
// the local session themselves (useAuthStore.clearSession()).
export function logout(): Promise<{ loggedOut: true }> {
  return unwrap(apiClient.post<ApiEnvelope<{ loggedOut: true }>>('/auth/logout'));
}
