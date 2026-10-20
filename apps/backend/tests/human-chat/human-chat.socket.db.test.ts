import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app, httpServer } from '../../src/server';
import { createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

jest.setTimeout(45_000);
const sockets: Socket[] = [];
let socketUrl: string;

function connect(token?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(socketUrl, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false, autoConnect: false });
    sockets.push(socket);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
    socket.connect();
  });
}

function join(socket: Socket, conversationId: string): Promise<{ ok: boolean }> {
  return new Promise((resolve) => socket.emit('conversation:join', { conversationId }, resolve));
}

function event(socket: Socket, name: string, timeoutMs = 3_000): Promise<{ conversationId: string; messageId?: string; messageIds?: string[]; readAt?: string; typing?: boolean }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Missing ${name} event`)), timeoutMs);
    socket.once(name, (payload) => { clearTimeout(timer); resolve(payload); });
  });
}

function deliveryAck(socket: Socket, conversationId: string, messageIds: string[]): Promise<{ ok: boolean }> {
  return new Promise((resolve) => socket.emit('delivery:ack', { conversationId, messageIds }, resolve));
}

beforeAll(async () => {
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  socketUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/human-chat`;
});
beforeEach(async () => { await resetDb(); await resetRedis(); });
afterEach(() => { for (const socket of sockets.splice(0)) socket.disconnect(); });
afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await prisma.$disconnect();
  await redis.quit();
});

async function fixture() {
  const buyer = await createTestUser('BUYER');
  const seller = await createTestUser('SELLER', { onboarded: true });
  await createTestProduct(seller.userId, { status: 'LIVE' });
  const store = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });
  const opened = await request(app).post('/api/v1/human-chat/conversations')
    .set('Authorization', `Bearer ${buyer.accessToken}`).send({ storeSlug: store.storeSlug });
  expect(opened.status).toBe(201);
  return { buyer, seller, conversationId: opened.body.data.id as string };
}

describe('F21 human chat Socket.IO on isolated services', () => {
  it('requires a recipient-device acknowledgement before Delivered and a persisted read before Seen', async () => {
    const { buyer, seller, conversationId } = await fixture();
    const buyerSocket = await connect(buyer.accessToken);
    expect(await join(buyerSocket, conversationId)).toEqual({ ok: true });
    const sent = await request(app).post(`/api/v1/human-chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${buyer.accessToken}`).field('clientId', randomUUID()).field('content', 'Status check');
    expect(sent.status).toBe(201);
    expect(sent.body.data.status).toBe('SENT');
    const senderHistory = () => request(app).get(`/api/v1/human-chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect((await senderHistory()).body.data.items[0].status).toBe('SENT');
    expect((await deliveryAck(buyerSocket, conversationId, [sent.body.data.id])).ok).toBe(false);
    expect(await prisma.humanMessageDelivery.count()).toBe(0);

    const stranger = await createTestUser('BUYER');
    const outsider = await connect(stranger.accessToken);
    expect((await deliveryAck(outsider, conversationId, [sent.body.data.id])).ok).toBe(false);

    const sellerSocket = await connect(seller.accessToken);
    const secondDevice = await connect(seller.accessToken);
    expect(await join(secondDevice, conversationId)).toEqual({ ok: true });
    const delivered = event(buyerSocket, 'delivery:changed');
    expect(await deliveryAck(sellerSocket, conversationId, [sent.body.data.id])).toMatchObject({ ok: true });
    expect(await delivered).toMatchObject({ conversationId, messageIds: [sent.body.data.id] });
    expect((await senderHistory()).body.data.items[0].status).toBe('DELIVERED');
    expect((await deliveryAck(secondDevice, conversationId, [sent.body.data.id])).ok).toBe(true);
    expect(await prisma.humanMessageDelivery.count()).toBe(1);

    const read = await request(app).post(`/api/v1/human-chat/conversations/${conversationId}/read`)
      .set('Authorization', `Bearer ${seller.accessToken}`).send({ lastSeenMessageId: sent.body.data.id });
    expect(read.status).toBe(200);
    expect((await senderHistory()).body.data.items[0].status).toBe('SEEN');
  });

  it('authenticates, rejects nonparticipant rooms, emits only after persistence, and suppresses retry broadcasts', async () => {
    const { buyer, seller, conversationId } = await fixture();
    await expect(connect()).rejects.toThrow('Unauthorized');
    const stranger = await createTestUser('BUYER');
    const outsider = await connect(stranger.accessToken);
    expect(await join(outsider, conversationId)).toEqual({ ok: false });
    const store = await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } });
    const otherConversation = await request(app).post('/api/v1/human-chat/conversations')
      .set('Authorization', `Bearer ${stranger.accessToken}`).send({ storeSlug: store.storeSlug });
    expect(otherConversation.status).toBe(201);
    const otherSocket = await connect(stranger.accessToken);
    expect(await join(otherSocket, otherConversation.body.data.id)).toEqual({ ok: true });
    const otherEvents: unknown[] = [];
    otherSocket.on('message:created', (payload) => otherEvents.push(payload));
    const buyerSocket = await connect(buyer.accessToken);
    const sellerSocket = await connect(seller.accessToken);
    expect(await join(buyerSocket, conversationId)).toEqual({ ok: true });
    expect(await join(sellerSocket, conversationId)).toEqual({ ok: true });

    const delivered = event(sellerSocket, 'message:created');
    const clientId = randomUUID();
    const send = () => request(app).post(`/api/v1/human-chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${buyer.accessToken}`).field('clientId', clientId).field('content', 'Hello');
    const first = await send();
    expect(first.status).toBe(201);
    expect(await delivered).toMatchObject({ conversationId, messageId: first.body.data.id });
    const events: unknown[] = [];
    sellerSocket.on('message:created', (payload) => events.push(payload));
    expect((await send()).body.data.id).toBe(first.body.data.id);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(events).toHaveLength(0);
    expect(otherEvents).toHaveLength(0);
    expect(await prisma.humanMessage.count()).toBe(1);
    expect(await prisma.notification.count({ where: { eventType: 'HUMAN_CHAT_MESSAGE' } })).toBe(1);

    const readNotice = event(buyerSocket, 'read:changed');
    const read = await request(app).post(`/api/v1/human-chat/conversations/${conversationId}/read`)
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(read.status).toBe(200);
    expect(await readNotice).toMatchObject({ conversationId, readAt: read.body.data.readAt });
  });

  it('does not emit on a failed save or blocked send, and recovers missed messages through REST', async () => {
    const { buyer, seller, conversationId } = await fixture();
    const sellerSocket = await connect(seller.accessToken);
    expect(await join(sellerSocket, conversationId)).toEqual({ ok: true });
    const events: unknown[] = [];
    sellerSocket.on('message:created', (payload) => events.push(payload));

    const transaction = jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('simulated save failure'));
    const failed = await request(app).post(`/api/v1/human-chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${buyer.accessToken}`).field('clientId', randomUUID()).field('content', 'Not saved');
    transaction.mockRestore();
    expect(failed.status).toBe(500);
    expect(await prisma.humanMessage.count()).toBe(0);
    expect(events).toHaveLength(0);

    sellerSocket.disconnect();
    const saved = await request(app).post(`/api/v1/human-chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${buyer.accessToken}`).field('clientId', randomUUID()).field('content', 'Missed while offline');
    expect(saved.status).toBe(201);
    const reconnected = await connect(seller.accessToken);
    expect(await join(reconnected, conversationId)).toEqual({ ok: true });
    const history = await request(app).get(`/api/v1/human-chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(history.body.data.items[0].id).toBe(saved.body.data.id);

    expect((await request(app).put(`/api/v1/human-chat/conversations/${conversationId}/block`)
      .set('Authorization', `Bearer ${seller.accessToken}`).send({ blocked: true })).status).toBe(200);
    const blocked = await request(app).post(`/api/v1/human-chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${buyer.accessToken}`).field('clientId', randomUUID()).field('content', 'Blocked');
    expect(blocked.status).toBe(403);
    expect(await prisma.humanMessage.count()).toBe(1);
  });

  it('limits typing to joined participants and clears it on stop, leave, and disconnect', async () => {
    const { buyer, seller, conversationId } = await fixture();
    const stranger = await createTestUser('BUYER');
    const buyerSocket = await connect(buyer.accessToken);
    const sellerSocket = await connect(seller.accessToken);
    const strangerSocket = await connect(stranger.accessToken);
    expect(await join(buyerSocket, conversationId)).toEqual({ ok: true });
    expect(await join(sellerSocket, conversationId)).toEqual({ ok: true });
    const leaked: unknown[] = [];
    strangerSocket.on('typing:changed', (payload) => leaked.push(payload));
    strangerSocket.emit('typing:set', { conversationId, typing: true });
    const started = event(sellerSocket, 'typing:changed');
    buyerSocket.emit('typing:set', { conversationId, typing: true });
    expect(await started).toMatchObject({ conversationId, typing: true });
    const stopped = event(sellerSocket, 'typing:changed');
    buyerSocket.emit('typing:set', { conversationId, typing: false });
    expect(await stopped).toMatchObject({ conversationId, typing: false });
    const restarted = event(sellerSocket, 'typing:changed');
    buyerSocket.emit('typing:set', { conversationId, typing: true });
    await restarted;
    const left = event(sellerSocket, 'typing:changed');
    buyerSocket.emit('conversation:leave', { conversationId });
    expect(await left).toMatchObject({ conversationId, typing: false });
    expect(await join(buyerSocket, conversationId)).toEqual({ ok: true });
    const startedAgain = event(sellerSocket, 'typing:changed');
    buyerSocket.emit('typing:set', { conversationId, typing: true });
    expect(await startedAgain).toMatchObject({ conversationId, typing: true });
    const disconnected = event(sellerSocket, 'typing:changed');
    buyerSocket.disconnect();
    expect(await disconnected).toMatchObject({ conversationId, typing: false });
    const expiringSocket = await connect(buyer.accessToken);
    expect(await join(expiringSocket, conversationId)).toEqual({ ok: true });
    const expiringStart = event(sellerSocket, 'typing:changed');
    expiringSocket.emit('typing:set', { conversationId, typing: true });
    expect(await expiringStart).toMatchObject({ conversationId, typing: true });
    const expired = event(sellerSocket, 'typing:changed', 7_000);
    expect(await expired).toMatchObject({ conversationId, typing: false });
    expect(leaked).toHaveLength(0);
  });
});
