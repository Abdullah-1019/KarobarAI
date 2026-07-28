import request from 'supertest';

import { app } from '../../src/server';

describe('errorHandler', () => {
  it('returns 400 VALIDATION_ERROR for malformed JSON, not a 500', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{not valid json');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });
});
