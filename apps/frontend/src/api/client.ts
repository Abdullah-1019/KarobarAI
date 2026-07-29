import axios from 'axios';

import { useAuthStore } from '../lib/authStore';

// Mirrors apps/backend's src/core/http/envelope.ts — every endpoint responds in this shape
// (TRD §9). Kept in sync by hand for now; move to packages/shared if it drifts.
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  timestamp: string;
}

const versionedBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

// healthRouter is mounted unprefixed in apps/backend/src/server.ts (not under /api/v1), so
// /health and /ready need the bare origin, not the versioned apiClient base.
export const apiRootUrl = versionedBaseUrl.replace(/\/api\/v1\/?$/, '');

// Single axios instance every feature's API calls share, instead of each feature configuring
// its own baseURL/interceptors.
export const apiClient = axios.create({
  baseURL: versionedBaseUrl,
  withCredentials: true,
});

// Attaches the in-memory access token (Feature 1) when present. Auth endpoints that don't need
// it (register/login/etc.) just won't have a token set yet, so this is a no-op for them.
apiClient.interceptors.request.use((requestConfig) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    requestConfig.headers.Authorization = `Bearer ${accessToken}`;
  }
  return requestConfig;
});

// Carries `code`/`details` (not just a message) so callers can switch on `error.code` per
// HO-F1-Auth.md ("switch on error.code, not HTTP status or message text").
export class ApiError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export async function unwrap<T>(request: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  try {
    const { data: envelope } = await request;
    if (!envelope.success || envelope.data === null) {
      throw new ApiError(envelope.error?.code ?? 'UNKNOWN', envelope.error?.message ?? 'Request failed', envelope.error?.details);
    }
    return envelope.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (axios.isAxiosError(err) && err.response?.data) {
      const envelope = err.response.data as ApiEnvelope<unknown>;
      throw new ApiError(
        envelope.error?.code ?? 'NETWORK_ERROR',
        envelope.error?.message ?? 'Request failed',
        envelope.error?.details,
      );
    }
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server');
  }
}
