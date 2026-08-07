import type { AiStagedImageDTO } from '@karobarai/shared';

import { redis } from '../../core/redis';

// Task 2/3 — resolves the module doc's own Task 2.4 ("frontend carries forward the images
// array") vs. Task 3.2 ("Core API resolves stagingId -> cdnUrl") tension: staging state lives
// here, in Redis, TTL'd, never a new Postgres table (schema stays frozen). Set once by the
// upload step (Task 2), read by generate (Task 3) and save (Task 6), deleted on successful save.
const STAGING_TTL_SECONDS = 60 * 60; // 1 hour — an abandoned upload naturally stops being
// resolvable after this; the underlying object-storage files themselves still need a separate
// cleanup job (Documentation Gap #2 in the module doc — not resolved by this TTL alone, see the
// handoff doc).

function stagingKey(stagingId: string): string {
  return `ai-store-builder:staging:${stagingId}`;
}

export async function saveStagingImages(stagingId: string, images: AiStagedImageDTO[]): Promise<void> {
  await redis.set(stagingKey(stagingId), JSON.stringify(images), 'EX', STAGING_TTL_SECONDS);
}

export async function getStagingImages(stagingId: string): Promise<AiStagedImageDTO[] | null> {
  const raw = await redis.get(stagingKey(stagingId));
  return raw ? (JSON.parse(raw) as AiStagedImageDTO[]) : null;
}

export async function deleteStagingImages(stagingId: string): Promise<void> {
  await redis.del(stagingKey(stagingId));
}
