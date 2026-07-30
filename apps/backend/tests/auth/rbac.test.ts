import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { signAccessToken } from '../../src/core/jwt';
import { authenticate } from '../../src/core/middleware/authenticate';
import { authorize } from '../../src/core/middleware/authorize';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { resetRedis } from '../helpers/reset';

// Throwaway route just to pin the 401-vs-403 boundary in isolation, without needing a real
// admin-only business endpoint (none exist yet — admin/catalog/order are future features).
app.get('/__test/admin-only', authenticate, authorize('ADMIN'), (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

beforeEach(async () => {
  await resetRedis();
});

afterAll(async () => {
  await redis.quit();
});

describe('authenticate + authorize', () => {
  it('rejects with 401 when no token is provided', async () => {
    const res = await request(app).get('/__test/admin-only');
    expect(res.status).toBe(401);
  });

  it('rejects with 401 for a garbage token', async () => {
    const res = await request(app).get('/__test/admin-only').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  it('rejects with 403 for a valid token that has the wrong role', async () => {
    const token = signAccessToken(randomUUID(), 'BUYER', randomUUID());
    const res = await request(app).get('/__test/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows a valid token with the right role', async () => {
    const token = signAccessToken(randomUUID(), 'ADMIN', randomUUID());
    const res = await request(app).get('/__test/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
