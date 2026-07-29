import { LiveStorageAdapter } from './live';

// Object storage adapter (TRD §28): MinIO in dev, real S3/Cloudinary-S3 in prod. Same D2 file
// shape as adapters/sms, adapters/email (interface + mock + live) — but NOT gated by
// ADAPTER_MODE like those are. MinIO needs no external credentials, and TRD §28 marks object
// storage "real (dev MinIO)" even at MVP, unlike payment/courier/sms which start mocked.
// getStorageAdapter() always returns the live (S3-compatible) implementation; MockStorageAdapter
// (./mock.ts) exists only as a manually-injectable test double (jest.mock), never reachable here.
export interface UploadParams {
  key: string; // caller-chosen path, e.g. "avatars/<userId>/<uuid>.jpg" — generic, not avatar-specific
  buffer: Buffer;
  contentType: string; // caller has already run magic-byte validation (Sec-012) before this
}

export interface StorageAdapter {
  upload(params: UploadParams): Promise<{ key: string; url: string }>;
  // Synchronous, not a presigned-URL call — assumes a public-read bucket. Avatar/product-image
  // URLs get persisted in Postgres; an expiring presigned URL would go stale sitting in a column.
  getUrl(key: string): string;
  delete(key: string): Promise<void>;
}

let cachedAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!cachedAdapter) {
    cachedAdapter = new LiveStorageAdapter();
  }
  return cachedAdapter;
}
