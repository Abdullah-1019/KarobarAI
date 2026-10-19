import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

// Storage is mocked so this database suite never writes customer-like media to development MinIO.
jest.mock('../../src/modules/returns/private-evidence.storage', () => ({
  savePrivateEvidence: jest.fn().mockResolvedValue(undefined),
  readPrivateEvidence: jest.fn().mockResolvedValue({ buffer: Buffer.from('image bytes'), contentType: 'image/png' }),
  deletePrivateEvidence: jest.fn().mockResolvedValue(undefined),
}));

jest.setTimeout(45_000); // Real bcrypt + isolated PostgreSQL fixtures exceed Jest's 5-second default.

beforeEach(async () => { await resetDb(); await resetRedis(); });
afterAll(async () => { await prisma.$disconnect(); await redis.quit(); });

describe('F21 human chat persistence on isolated database', () => {
  it('creates one buyer-store conversation, persists messages and one notification on retries, and tracks reads', async () => {
    const buyer = await createTestUser('BUYER');
    const seller = await createTestUser('SELLER', { onboarded: true });
    await prisma.user.update({ where: { userId: seller.userId }, data: { preferredLanguage: 'EN' } });
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });
    const slug = (await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } })).storeSlug;
    const open = () => request(app).post('/api/v1/human-chat/conversations').set('Authorization', `Bearer ${buyer.accessToken}`).send({ storeSlug: slug, productPublicId: product.publicId });
    const first = await open(); const again = await open();
    expect(first.status).toBe(201);
    expect(again.body.data.id).toBe(first.body.data.id);
    expect(await prisma.humanConversation.count()).toBe(1);
    const id = first.body.data.id as string;
    const clientId = randomUUID();
    const send = () => request(app).post(`/api/v1/human-chat/conversations/${id}/messages`).set('Authorization', `Bearer ${buyer.accessToken}`).field('clientId', clientId).field('content', 'Is this in stock?');
    const sent = await send(); const retried = await send();
    expect(sent.status).toBe(201);
    expect(retried.body.data.id).toBe(sent.body.data.id);
    expect(await prisma.humanMessage.count()).toBe(1);
    expect(await prisma.notification.count({ where: { userId: seller.userId, eventType: 'HUMAN_CHAT_MESSAGE' } })).toBe(1);
    const unnamedNotice = await prisma.notification.findFirstOrThrow({ where: { userId: seller.userId, eventType: 'HUMAN_CHAT_MESSAGE' } });
    expect(unnamedNotice.message).toBe('You have a new message');
    const sellerHeaders = { Authorization: `Bearer ${seller.accessToken}` };
    expect((await request(app).patch('/api/v1/profile/me/display-name')
      .set('Authorization', `Bearer ${buyer.accessToken}`).send({ displayName: 'Ayesha Khan' })).status).toBe(200);
    expect((await request(app).patch('/api/v1/profile/me/display-name')
      .set('Authorization', `Bearer ${seller.accessToken}`).send({ displayName: 'Impersonated' })).status).toBe(403);
    const unread = await request(app).get('/api/v1/human-chat/unread-count').set(sellerHeaders);
    expect(unread.body.data.unreadCount).toBe(1);
    const list = await request(app).get('/api/v1/human-chat/conversations').set(sellerHeaders);
    expect(list.body.data.items[0].unreadCount).toBe(1);
    expect(list.body.data.items[0].buyerName).toBe('Ayesha Khan');
    expect(list.body.data.items[0].buyerPublicId).toBeUndefined();
    const page = await request(app).get(`/api/v1/human-chat/conversations/${id}/messages`).set(sellerHeaders);
    expect(page.body.data.items.map((item: { content: string }) => item.content)).toEqual(['Is this in stock?']);
    const read = await request(app).post(`/api/v1/human-chat/conversations/${id}/read`).set(sellerHeaders);
    expect(read.status).toBe(200);
    const buyerHistory = await request(app).get(`/api/v1/human-chat/conversations/${id}/messages`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(buyerHistory.body.data.items[0].seen).toBe(true);
    expect((await request(app).get('/api/v1/human-chat/unread-count').set(sellerHeaders)).body.data.unreadCount).toBe(0);
    for (const text of ['Second', 'Third']) {
      expect((await request(app).post(`/api/v1/human-chat/conversations/${id}/messages`).set('Authorization', `Bearer ${buyer.accessToken}`)
        .field('clientId', randomUUID()).field('content', text)).status).toBe(201);
    }
    const namedNotice = await prisma.notification.findFirstOrThrow({
      where: { userId: seller.userId, eventType: 'HUMAN_CHAT_MESSAGE' }, orderBy: { createdAt: 'desc' },
    });
    expect(namedNotice.message).toBe('Ayesha Khan sent you a message');
    const newest = await request(app).get(`/api/v1/human-chat/conversations/${id}/messages`).query({ limit: 2 }).set(sellerHeaders);
    expect(newest.body.data.items.map((item: { content: string }) => item.content)).toEqual(['Third', 'Second']);
    const older = await request(app).get(`/api/v1/human-chat/conversations/${id}/messages`).query({ limit: 2, cursor: newest.body.data.nextCursor }).set(sellerHeaders);
    expect(older.body.data.items.map((item: { content: string }) => item.content)).toEqual(['Is this in stock?']);
  });

  it('keeps another buyer and another seller out, validates product context, and blocks sends', async () => {
    const buyer = await createTestUser('BUYER');
    const stranger = await createTestUser('BUYER');
    const seller = await createTestUser('SELLER', { onboarded: true });
    const otherSeller = await createTestUser('SELLER', { onboarded: true });
    const product = await createTestProduct(seller.userId, { status: 'LIVE' });
    const otherProduct = await createTestProduct(otherSeller.userId, { status: 'LIVE' });
    const slug = (await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } })).storeSlug;
    const wrongProduct = await request(app).post('/api/v1/human-chat/conversations').set('Authorization', `Bearer ${buyer.accessToken}`).send({ storeSlug: slug, productPublicId: otherProduct.publicId });
    expect(wrongProduct.status).toBe(404);
    const opened = await request(app).post('/api/v1/human-chat/conversations').set('Authorization', `Bearer ${buyer.accessToken}`).send({ storeSlug: slug, productPublicId: product.publicId });
    const id = opened.body.data.id as string;
    for (const token of [stranger.accessToken, otherSeller.accessToken]) {
      expect((await request(app).get(`/api/v1/human-chat/conversations/${id}/messages`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
      expect((await request(app).get(`/api/v1/human-chat/conversations/${id}/attachments/fake`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
      expect((await request(app).put(`/api/v1/human-chat/conversations/${id}/block`).set('Authorization', `Bearer ${token}`).send({ blocked: true })).status).toBe(404);
      expect((await request(app).post(`/api/v1/human-chat/conversations/${id}/reports`).set('Authorization', `Bearer ${token}`).send({ reason: 'Repeated unwanted contact' })).status).toBe(404);
    }
    expect((await request(app).put(`/api/v1/human-chat/conversations/${id}/block`).set('Authorization', `Bearer ${seller.accessToken}`).send({ blocked: true })).status).toBe(200);
    expect((await request(app).post(`/api/v1/human-chat/conversations/${id}/messages`).set('Authorization', `Bearer ${buyer.accessToken}`).field('clientId', randomUUID()).field('content', 'Hello')).status).toBe(403);
  });

  it('rejects invalid image data and records participant reports without touching AI chat tables', async () => {
    const buyer = await createTestUser('BUYER');
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { status: 'LIVE' });
    const slug = (await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } })).storeSlug;
    const opened = await request(app).post('/api/v1/human-chat/conversations').set('Authorization', `Bearer ${buyer.accessToken}`).send({ storeSlug: slug });
    const id = opened.body.data.id as string;
    const bad = await request(app).post(`/api/v1/human-chat/conversations/${id}/messages`).set('Authorization', `Bearer ${buyer.accessToken}`)
      .field('clientId', randomUUID()).attach('images', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' });
    expect(bad.status).toBe(400);
    expect(await prisma.humanMessage.count()).toBe(0);
    const report = await request(app).post(`/api/v1/human-chat/conversations/${id}/reports`).set('Authorization', `Bearer ${buyer.accessToken}`).send({ reason: 'Repeated unwanted contact' });
    expect(report.status).toBe(201);
    expect(await prisma.humanConversationReport.count()).toBe(1);
    expect(await prisma.chatSession.count()).toBe(0);
    expect(await prisma.chatMessage.count()).toBe(0);
  });

  it('persists valid attachment metadata and serves bytes only to participants', async () => {
    const buyer = await createTestUser('BUYER');
    const stranger = await createTestUser('BUYER');
    const seller = await createTestUser('SELLER', { onboarded: true });
    await createTestProduct(seller.userId, { status: 'LIVE' });
    const slug = (await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: seller.userId } })).storeSlug;
    const opened = await request(app).post('/api/v1/human-chat/conversations').set('Authorization', `Bearer ${buyer.accessToken}`).send({ storeSlug: slug });
    const id = opened.body.data.id as string;
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlAAAAABJRU5ErkJggg==', 'base64');
    const sent = await request(app).post(`/api/v1/human-chat/conversations/${id}/messages`).set('Authorization', `Bearer ${buyer.accessToken}`)
      .field('clientId', randomUUID()).attach('images', png, { filename: 'fixture.png', contentType: 'text/plain' });
    expect(sent.status).toBe(201); // detected bytes, not the supplied MIME label
    expect(sent.body.data.attachments).toHaveLength(1);
    const attachmentId = sent.body.data.attachments[0].id as string;
    expect((await prisma.humanMessageAttachment.findUniqueOrThrow({ where: { id: attachmentId } })).mimeType).toBe('image/png');
    expect((await request(app).get(`/api/v1/human-chat/conversations/${id}/attachments/${attachmentId}`).set('Authorization', `Bearer ${stranger.accessToken}`)).status).toBe(404);
    const image = await request(app).get(`/api/v1/human-chat/conversations/${id}/attachments/${attachmentId}`).set('Authorization', `Bearer ${seller.accessToken}`);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toMatch(/image\/png/);
    expect(image.headers['cache-control']).toBe('private, no-store');
  });
});
