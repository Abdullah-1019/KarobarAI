import request from 'supertest';

import { app } from '../src/server';

describe('GET /health', () => {
  it('returns the standard envelope with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { status: 'ok', service: 'api' },
      error: null,
    });
    expect(typeof res.body.timestamp).toBe('string');
  });
});
