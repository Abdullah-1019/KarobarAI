export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  timestamp: string;
}

export function ok<T>(data: T): ApiEnvelope<T> {
  return { success: true, data, error: null, timestamp: new Date().toISOString() };
}

export function fail(code: string, message: string, details?: unknown): ApiEnvelope<null> {
  return { success: false, data: null, error: { code, message, details }, timestamp: new Date().toISOString() };
}
