// Per-domain TanStack Query hooks (catalog, cart, orders, ...) — added as each feature's API
// lands, built on top of the shared `apiClient`/`unwrap` below.
export { apiClient, unwrap } from './client';
export type { ApiEnvelope } from './client';
