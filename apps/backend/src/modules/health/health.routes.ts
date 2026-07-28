import { Router } from 'express';

import { DependencyError } from '../../core/errors/AppError';
import { ok } from '../../core/http/envelope';
import { prisma } from '../../core/prisma';
import { redis } from '../../core/redis';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.status(200).json(ok({ status: 'ok', service: 'api' }));
});

const READY_CHECK_TIMEOUT_MS = 2000;

// ioredis retries connection attempts indefinitely by default (required elsewhere for BullMQ,
// core/redis/index.ts), so a bare `redis.ping()` never rejects on its own if Redis is down — it
// just hangs. Race it against a timeout so a stopped/uninstalled Redis fails this check quickly
// instead of hanging the request.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms)),
  ]);
}

// Readiness (TRD §24): confirms Postgres and Redis are actually reachable, not just that the
// process is up. Added alongside Auth (Phase 3) since it's the first feature with a real Redis
// dependency — a stopped/uninstalled Redis should fail loudly here, not surface as a confusing
// mid-request timeout inside OTP/login/lockout.
healthRouter.get('/ready', async (_req, res, next) => {
  const [postgresResult, redisResult] = await Promise.allSettled([
    withTimeout(prisma.$queryRaw`SELECT 1`, READY_CHECK_TIMEOUT_MS),
    withTimeout(redis.ping(), READY_CHECK_TIMEOUT_MS),
  ]);

  const postgresOk = postgresResult.status === 'fulfilled';
  const redisOk = redisResult.status === 'fulfilled';

  if (!postgresOk || !redisOk) {
    next(
      new DependencyError('One or more dependencies are unreachable', { postgres: postgresOk, redis: redisOk }),
    );
    return;
  }

  res.status(200).json(ok({ status: 'ready', postgres: true, redis: true }));
});
