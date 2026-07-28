import axios from 'axios';

// Mirrors apps/backend's src/core/http/envelope.ts — every endpoint responds in this shape
// (TRD §9). Kept in sync by hand for now; move to packages/shared if it drifts.
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  timestamp: string;
}

// Single axios instance every feature's API calls share, instead of each feature configuring
// its own baseURL/interceptors. No auth interceptor yet — token attachment lands with Feature 1.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1',
  withCredentials: true,
});

export async function unwrap<T>(request: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const { data: envelope } = await request;
  if (!envelope.success || envelope.data === null) {
    throw new Error(envelope.error?.message ?? 'Request failed');
  }
  return envelope.data;
}
