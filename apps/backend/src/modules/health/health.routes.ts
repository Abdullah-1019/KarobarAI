import { Router } from 'express';

import { checkDependencies } from '../../core/health/checkDependencies';
import { DependencyError } from '../../core/errors/AppError';
import { ok } from '../../core/http/envelope';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.status(200).json(ok({ status: 'ok', service: 'api' }));
});

// Readiness (TRD §24): confirms Postgres and Redis are actually reachable, not just that the
// process is up. Added alongside Auth (Phase 3) since it's the first feature with a real Redis
// dependency — a stopped/uninstalled Redis should fail loudly here, not surface as a confusing
// mid-request timeout inside OTP/login/lockout.
healthRouter.get('/ready', async (_req, res, next) => {
  const { postgres, redis } = await checkDependencies();

  if (!postgres || !redis) {
    next(new DependencyError('One or more dependencies are unreachable', { postgres, redis }));
    return;
  }

  res.status(200).json(ok({ status: 'ready', postgres: true, redis: true }));
});
