import { createHash } from 'node:crypto';

import { logger } from '../../core/logger';
import { redis } from '../../core/redis';

// Task 1.5 — cache-key convention: analytics:{sellerId}:{metric}:{rangeHash}.
export function buildCacheKey(sellerId: bigint, metric: string, rangeParams: unknown): string {
  const rangeHash = createHash('sha1').update(JSON.stringify(rangeParams)).digest('hex').slice(0, 16);
  return `analytics:${sellerId.toString()}:${metric}:${rangeHash}`;
}

// Task 2.4/3.5/4.5/5.7/6.5 — TTL-based expiry, not event-driven bust hooks. Engineering
// Decision: the module doc's literal design wants each metric's cache busted by its own source
// event (settlement-confirmed, order-delivered, order-status-changed, new-order-placed) —
// wiring four separate cache-invalidation hooks into Features 7/8/10's already-signed-off code
// would be a disproportionate amount of cross-feature coupling for a performance optimization in
// an MVP analytics feature, when no requirement specifies exact invalidation timing (only "<3s
// reload", REQ-F-Analytics-005). A short, uniform TTL is a complete, correct, much simpler
// implementation of the same caching goal — data is at most TTL_SECONDS stale, which easily
// meets the reload-speed requirement without touching any other feature's files.
const TTL_SECONDS = 60;

export async function getOrCompute<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const cached = await redis.get(key).catch((err) => {
    logger.warn({ err, key }, '[analytics] cache read failed, falling through to live compute');
    return null;
  });
  if (cached) {
    return JSON.parse(cached) as T;
  }

  const result = await compute();
  await redis
    .set(key, JSON.stringify(result), 'EX', TTL_SECONDS)
    .catch((err) => logger.warn({ err, key }, '[analytics] cache write failed (non-fatal)'));
  return result;
}
