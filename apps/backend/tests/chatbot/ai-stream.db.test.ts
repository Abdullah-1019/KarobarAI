import { randomUUID } from 'node:crypto';
import request from 'supertest';

jest.mock('../../src/modules/chatbot/scope-guard.service', () => ({ isMessageInScope: jest.fn().mockResolvedValue(true) }));
jest.mock('../../src/modules/chatbot/slm-client', () => ({
  chatWithLocalModel: jest.fn(),
  chatWithLocalModelStream: jest.fn(async (_messages, _tools, onDelta: (text: string) => void) => {
    onDelta('Hel'); onDelta('lo'); return { reply: 'Hello' };
  }),
  SAFE_AGENT_REPLY: 'Safe reply',
}));

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

beforeEach(async () => { await resetDb(); await resetRedis(); }, 30_000);
afterAll(async () => { await prisma.$disconnect(); await redis.quit(); });

describe('seller AI stream persistence on isolated services', () => {
  it('requires an authenticated seller', async () => {
    const payload = { message: 'How are my sales?', locale: 'en', requestId: randomUUID() };
    expect((await request(app).post('/api/v1/seller/chat/stream').send(payload)).status).toBe(401);
    const buyer = await createTestUser('BUYER');
    expect((await request(app).post('/api/v1/seller/chat/stream')
      .set('Authorization', `Bearer ${buyer.accessToken}`).send(payload)).status).toBe(403);
    expect(await prisma.chatMessage.count()).toBe(0);
  });

  it('streams deltas, saves one final reply, and reuses it on a retry', async () => {
    const seller = await createTestUser('SELLER', { onboarded: true });
    const payload = { message: 'How are my sales?', locale: 'en', requestId: randomUUID() };
    const send = () => request(app).post('/api/v1/seller/chat/stream')
      .set('Authorization', `Bearer ${seller.accessToken}`).send(payload);
    const first = await send();
    expect(first.status).toBe(200);
    expect(first.text).toContain('event: delta\ndata: {"text":"Hel"}');
    expect(first.text).toContain('event: complete');
    expect(await prisma.chatMessage.count()).toBe(2);
    const second = await send();
    expect(second.status).toBe(200);
    expect(second.text).toContain('"reply":"Hello"');
    expect(await prisma.chatMessage.count()).toBe(2);
  });
});
