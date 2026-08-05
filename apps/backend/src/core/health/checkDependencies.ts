import { prisma } from '../prisma';
import { redis } from '../redis';

const CHECK_TIMEOUT_MS = 2000;

// ioredis retries connection attempts indefinitely by default (required elsewhere for BullMQ),
// so a bare `redis.ping()` never rejects on its own if Redis is down — it just hangs. Race it
// against a timeout so a stopped/uninstalled dependency fails this check quickly.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);
}

export interface DependencyStatus {
  postgres: boolean;
  redis: boolean;
}

// Extracted from health.routes.ts's /ready handler (TRD §24) so it has a second caller: Feature
// 12's admin dashboard `adapterUptime` KPI reuses this exact reachability check rather than
// duplicating it — see that module's own comment on why it's an instantaneous snapshot, not a
// true rolling uptime percentage (no adapter-call counter infrastructure exists in this codebase).
export async function checkDependencies(): Promise<DependencyStatus> {
  const [postgresResult, redisResult] = await Promise.allSettled([
    withTimeout(prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS),
    withTimeout(redis.ping(), CHECK_TIMEOUT_MS),
  ]);
  return { postgres: postgresResult.status === 'fulfilled', redis: redisResult.status === 'fulfilled' };
}
