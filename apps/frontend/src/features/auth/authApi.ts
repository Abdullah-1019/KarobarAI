import type { LoginInput, OtpResendInput, OtpVerifyInput, RegisterInput } from '@karobarai/shared';

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
