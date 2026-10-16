import axios from 'axios';
import { Queue } from 'bullmq';
import request from 'supertest';

import { prisma } from '../../src/core/prisma';
import { config } from '../../src/core/config';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { closeNotificationQueue } from '../../src/modules/notification';
import { closeReturnInspectionResources, inspectReturnCase, recoverAbandonedInspections } from '../../src/modules/returns/return-inspection.service';
import { readPrivateEvidence, savePrivateEvidence } from '../../src/modules/returns/private-evidence.storage';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

jest.mock('../../src/modules/returns/private-evidence.storage', () => ({
  readPrivateEvidence: jest.fn(), savePrivateEvidence: jest.fn(), deletePrivateEvidence: jest.fn(),
}));

const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const queueAdd = jest.spyOn(Queue.prototype, 'add').mockResolvedValue({} as never);
const aiPost = jest.spyOn(axios, 'post');
const imageGet = jest.spyOn(axios, 'get');

beforeEach(async () => {
  config.returnDecisions.enabled = true;
  config.returnDecisions.acceptThreshold = 0.80;
  config.returnDecisions.reviewThreshold = 0.60;
  await resetDb();
  await resetRedis();
  queueAdd.mockClear();
  aiPost.mockReset();
  imageGet.mockReset().mockResolvedValue({ data: png, headers: { 'content-type': 'image/png' } } as never);
  jest.mocked(readPrivateEvidence).mockReset().mockResolvedValue({ buffer: png, contentType: 'image/png' });
  jest.mocked(savePrivateEvidence).mockReset().mockResolvedValue(undefined);
});

afterAll(async () => {
  await closeReturnInspectionResources();
  await closeNotificationQueue();
  await prisma.$disconnect();
  await redis.quit();
  queueAdd.mockRestore();
  aiPost.mockRestore();
  imageGet.mockRestore();
});

async function fixture(options: { category?: string | null; references?: number } = {}) {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const slug = options.category === undefined ? 'clothing' : options.category;
  const category = slug ? await prisma.category.upsert({ where: { slug },
    create: { slug, nameEn: slug, nameUr: slug }, update: {} }) : null;
  const product = await createTestProduct(seller.userId, { categoryId: category?.categoryId });
  for (let index = 0; index < (options.references ?? 2); index += 1) {
    await prisma.productImage.create({ data: { productId: product.productId, position: index,
      cdnUrl: `${config.storage.publicBaseUrl}/${config.storage.bucket}/product-${product.productId}-${index}.png` } });
  }
  const order = await createTestOrder(buyer.userId, seller.userId, product, {
    status: 'COMPLETED', deliveredAt: new Date(), buyerConfirmedAt: new Date(), categorySlugSnapshot: slug,
  });
  const created = await request(app).post('/api/v1/returns').set('Authorization', `Bearer ${buyer.accessToken}`)
    .send({ orderId: order.publicId, productId: product.publicId, reasonCode: 'NOT_AS_DESCRIBED' });
  expect(created.status).toBe(201);
  const returnId = BigInt(created.body.data.id);
  for (let index = 0; index < (options.references === 0 ? 3 : options.references ?? 2); index += 1) {
    await prisma.returnImage.create({ data: {
      returnId, cdnUrl: '', storageKey: `returns/${returnId}/photo-${index}.png`,
    } });
  }
  return { seller, buyer, product, order, returnId };
}

async function submit(buyerToken: string, returnId: bigint) {
  const response = await request(app).post(`/api/v1/returns/${returnId}/submit`)
    .set('Authorization', `Bearer ${buyerToken}`);
  expect(response.status).toBe(200);
  expect(response.body.data.status).toBe('UNDER_AI_REVIEW');
}

function comparisonResponse(status = 'LIKELY_MATCH', score: number | null = 0.95) {
  return { data: {
    provider: 'dinov2', model: 'facebook/dinov2-small',
    revision: 'ed25f3a31f01632728cabb09d1542f84ab7b0056',
    policy_version: 'dinov2_comparison_v1', status, similarity_score: score,
    reference_image_count: 2, return_image_count: 2,
    pairs: [{ index: 1, similarity_score: score ?? 0 }, { index: 2, similarity_score: score ?? 0 }],
    evidence_sufficient: status === 'LIKELY_MATCH' || status === 'POSSIBLE_MISMATCH',
    reason_code: status === 'LIKELY_MATCH' ? 'HIGH_SIMILARITY' : 'LOW_SIMILARITY',
    processed_at: new Date().toISOString(),
  } };
}

it('rejects another buyer order item and a client-supplied category', async () => {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const product = await createTestProduct(seller.userId);
  const other = await createTestProduct(seller.userId);
  const order = await createTestOrder(buyer.userId, seller.userId, product, {
    status: 'COMPLETED', deliveredAt: new Date(), buyerConfirmedAt: new Date(),
  });
  const path = '/api/v1/returns';
  const auth = `Bearer ${buyer.accessToken}`;
  expect((await request(app).post(path).set('Authorization', auth).send({
    orderId: order.publicId, productId: other.publicId, reasonCode: 'DAMAGED',
  })).status).toBe(400);
  expect((await request(app).post(path).set('Authorization', auth).send({
    orderId: order.publicId, productId: product.publicId, reasonCode: 'DAMAGED', category: 'clothing',
  })).status).toBe(400);
  expect(await prisma.return.count({ where: { orderId: order.orderId } })).toBe(0);
});

it('keeps return evidence private and exposes only the purchased item listing references', async () => {
  const { buyer, product, returnId } = await fixture();
  const stranger = await createTestUser('BUYER');
  const image = await prisma.returnImage.findFirstOrThrow({ where: { returnId } });
  const path = `/api/v1/returns/${returnId}/images/${image.returnImageId}/content`;
  expect((await request(app).get(path).set('Authorization', `Bearer ${stranger.accessToken}`)).status).toBe(403);
  expect((await request(app).get(path).set('Authorization', `Bearer ${buyer.accessToken}`)).status).toBe(200);
  const detail = await request(app).get(`/api/v1/returns/${returnId}`).set('Authorization', `Bearer ${buyer.accessToken}`);
  expect(detail.body.data.referenceImages).toHaveLength(2);
  expect((await request(app).get(`/api/v1/returns/${returnId}`).set('Authorization', `Bearer ${stranger.accessToken}`)).status).toBe(403);
  expect((await request(app).get(`/api/v1/returns/${returnId}/dispatch-images/1/content`).set('Authorization', `Bearer ${buyer.accessToken}`)).status).toBe(404);
  expect(product.publicId).toBeTruthy();
});

it('automatically accepts valid high-similarity evidence without a refund and allows an audited seller override', async () => {
  const { seller, buyer, returnId } = await fixture();
  const outsider = await createTestUser('SELLER', { onboarded: true });
  await submit(buyer.accessToken, returnId);
  expect(queueAdd).toHaveBeenCalled();
  aiPost.mockResolvedValueOnce(comparisonResponse() as never);
  await inspectReturnCase(returnId);
  const row = await prisma.return.findUniqueOrThrow({ where: { returnId }, include: { inspection: true } });
  expect(row.status).toBe('APPROVED');
  expect(row.inspection?.outcome).toBe('LIKELY_MATCH');
  expect(row.inspection?.confidence).toBe(0.95);
  expect(row.inspection?.provider).toBe('dinov2');
  expect(row.decision).toBe('APPROVED');
  expect(row.refundedAt).toBeNull();
  const buyerDetail = await request(app).get(`/api/v1/returns/${returnId}`)
    .set('Authorization', `Bearer ${buyer.accessToken}`);
  expect(buyerDetail.body.data.status).toBe('APPROVED');
  expect(buyerDetail.body.data.returnShipping).toEqual({
    status: 'NOT_BOOKED', courier: null, bookingReference: null, trackingNumber: null,
    trackingUrl: null, estimatedPickupAt: null, estimatedDeliveryAt: null,
  });
  expect(aiPost).toHaveBeenCalledWith(expect.stringContaining('/internal/compare-return-images'),
    expect.objectContaining({ reference_images: expect.any(Array), return_images: expect.any(Array) }), expect.anything());
  expect(row.inspection?.predictions).toMatchObject({ pairs: [{ index: 1 }, { index: 2 }],
    aiDecision: { status: 'APPROVED', acceptThreshold: 0.8, reviewThreshold: 0.6 } });
  const decisionAudits = await prisma.auditLog.count({ where: { entity: 'returns', entityId: returnId,
    reason: { startsWith: 'Automated return decision:' } } });
  await inspectReturnCase(returnId);
  expect(await prisma.auditLog.count({ where: { entity: 'returns', entityId: returnId,
    reason: { startsWith: 'Automated return decision:' } } })).toBe(decisionAudits);
  expect((await request(app).get(`/api/v1/seller/returns/${returnId}`).set('Authorization', `Bearer ${outsider.accessToken}`)).status).toBe(403);
  const active = await request(app).get('/api/v1/seller/returns').set('Authorization', `Bearer ${seller.accessToken}`);
  expect(active.body.data.items.map((item: { id: string }) => item.id)).toContain(returnId.toString());
  const missingReason = await request(app).post(`/api/v1/seller/returns/${returnId}/decision`)
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .send({ decision: 'REJECTED', reason: '   ' });
  expect(missingReason.status).toBe(400);
  expect((await request(app).post(`/api/v1/seller/returns/${returnId}/decision`)
    .set('Authorization', `Bearer ${outsider.accessToken}`)
    .send({ decision: 'REJECTED', reason: 'Not the owner' })).status).toBe(403);
  const decision = await request(app).post(`/api/v1/seller/returns/${returnId}/decision`)
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .send({ decision: 'REJECTED', reason: 'Seller reviewed both photo sets' });
  expect(decision.status).toBe(200);
  expect(decision.body.data.status).toBe('REJECTED');
  expect(decision.body.data.decisionSource).toBe('SELLER');
  expect(decision.body.data.inspection.aiDecision.status).toBe('APPROVED');
  expect(decision.body.data.sellerOverrideReason).toBe('Seller reviewed both photo sets');
  expect(decision.body.data.refundStatus).toBe('NOT_ISSUED');
  const queuedAfterOverride = queueAdd.mock.calls.length;
  expect((await request(app).post(`/api/v1/seller/returns/${returnId}/decision`)
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .send({ decision: 'REJECTED', reason: 'Second click' })).status).toBe(422);
  expect(queueAdd.mock.calls.length).toBe(queuedAfterOverride);
  expect(await prisma.auditLog.count({ where: { entity: 'returns', entityId: returnId,
    reason: { startsWith: 'Seller override of AI acceptance:' } } })).toBe(1);
});

it.each([
  [0.998, 'LIKELY_MATCH', 'APPROVED'],
  [0.439, 'POSSIBLE_MISMATCH', 'REJECTED'],
] as const)('persists a %s comparison as %s and returns it to its buyer', async (score, outcome, expected) => {
  const { seller, buyer, returnId } = await fixture();
  await submit(buyer.accessToken, returnId);
  aiPost.mockResolvedValueOnce(comparisonResponse(outcome, score) as never);
  await inspectReturnCase(returnId);
  const detail = await request(app).get(`/api/v1/returns/${returnId}`)
    .set('Authorization', `Bearer ${buyer.accessToken}`);
  expect(detail.status).toBe(200);
  expect(detail.body.data.status).toBe(expected);
  expect(detail.body.data.decision).toBe(expected);
  expect(detail.body.data.decisionSource).toBe('AI');
  expect(detail.body.data.inspection.aiDecision).toBeNull();
  const sellerDetail = await request(app).get(`/api/v1/seller/returns/${returnId}`)
    .set('Authorization', `Bearer ${seller.accessToken}`);
  expect(sellerDetail.body.data.inspection.aiDecision.similarityScore).toBe(score);
  expect(detail.body.data.decidedAt).toBeTruthy();
});

it('does not record a late AI decision after a return leaves inspection', async () => {
  const { buyer, returnId } = await fixture();
  await submit(buyer.accessToken, returnId);
  aiPost.mockImplementationOnce(async () => {
    await prisma.return.update({ where: { returnId }, data: {
      status: 'REJECTED', decision: 'REJECTED', decidedAt: new Date(),
    } });
    return comparisonResponse('LIKELY_MATCH', 0.998) as never;
  });
  await inspectReturnCase(returnId);
  const row = await prisma.return.findUniqueOrThrow({ where: { returnId }, include: { inspection: true } });
  expect(row.status).toBe('REJECTED');
  expect(row.decision).toBe('REJECTED');
  expect(row.inspection?.predictions).not.toHaveProperty('aiDecision');
  await inspectReturnCase(returnId);
  expect((await prisma.return.findUniqueOrThrow({ where: { returnId } })).status).toBe('REJECTED');
});

it('never exposes outbound order tracking as return-leg tracking', async () => {
  const { buyer, order, returnId } = await fixture();
  await prisma.order.update({ where: { orderId: order.orderId }, data: {
    courier: 'TCS', trackingNo: 'OUTBOUND-ONLY',
  } });
  await prisma.return.update({ where: { returnId }, data: { status: 'PICKUP_BOOKED' } });
  const detail = await request(app).get(`/api/v1/returns/${returnId}`)
    .set('Authorization', `Bearer ${buyer.accessToken}`);
  expect(detail.status).toBe(200);
  expect(detail.body.data.returnShipping.status).toBe('BOOKING_DETAILS_UNAVAILABLE');
  expect(detail.body.data.returnShipping.trackingNumber).toBeNull();
  expect(JSON.stringify(detail.body.data.returnShipping)).not.toContain('OUTBOUND-ONLY');
});

it('uses the same comparison service for non-clothing products', async () => {
  const { seller, buyer, returnId } = await fixture({ category: 'shoes' });
  await submit(buyer.accessToken, returnId);
  aiPost.mockResolvedValueOnce(comparisonResponse('POSSIBLE_MISMATCH', 0.42) as never);
  await inspectReturnCase(returnId);
  const row = await prisma.return.findUniqueOrThrow({ where: { returnId }, include: { inspection: true } });
  expect(row.status).toBe('REJECTED');
  expect(row.inspection?.provider).toBe('dinov2');
  expect(row.inspection?.categorySlug).toBe('shoes');
  expect(row.inspection?.outcome).toBe('POSSIBLE_MISMATCH');
  expect(row.decision).toBe('REJECTED');
  expect(row.refundedAt).toBeNull();
  const detail = await request(app).get(`/api/v1/returns/${returnId}`)
    .set('Authorization', `Bearer ${buyer.accessToken}`);
  expect(detail.body.data.decisionSource).toBe('AI');
  expect(detail.body.data.inspection.aiDecision).toBeNull();
  const sellerDetail = await request(app).get(`/api/v1/seller/returns/${returnId}`)
    .set('Authorization', `Bearer ${seller.accessToken}`);
  expect(sellerDetail.body.data.inspection.aiDecision.reason).toBe('LOW_SIMILARITY');
});

it('routes a valid middle-band comparison to seller review and honours the automation switch', async () => {
  const middle = await fixture();
  await submit(middle.buyer.accessToken, middle.returnId);
  aiPost.mockResolvedValueOnce(comparisonResponse('POSSIBLE_MISMATCH', 0.7) as never);
  await inspectReturnCase(middle.returnId);
  const pending = await prisma.return.findUniqueOrThrow({ where: { returnId: middle.returnId } });
  expect(pending.status).toBe('MANUAL_REVIEW');
  expect(pending.decision).toBeNull();

  const disabled = await fixture();
  await submit(disabled.buyer.accessToken, disabled.returnId);
  config.returnDecisions.enabled = false;
  aiPost.mockResolvedValueOnce(comparisonResponse('LIKELY_MATCH', 0.95) as never);
  await inspectReturnCase(disabled.returnId);
  const held = await prisma.return.findUniqueOrThrow({ where: { returnId: disabled.returnId }, include: { inspection: true } });
  expect(held.status).toBe('MANUAL_REVIEW');
  expect(held.inspection?.predictions).toMatchObject({ aiDecision: { reason: 'AUTOMATION_DISABLED' } });
});

it('routes missing listing photos to manual review without an invented score', async () => {
  const { buyer, returnId } = await fixture({ references: 0 });
  const submitted = await request(app).post(`/api/v1/returns/${returnId}/submit`)
    .set('Authorization', `Bearer ${buyer.accessToken}`);
  expect(submitted.status).toBe(200);
  const row = await prisma.return.findUniqueOrThrow({ where: { returnId }, include: { inspection: true } });
  expect(row.status).toBe('MANUAL_REVIEW');
  expect(row.inspection).toBeNull();
  expect(aiPost).not.toHaveBeenCalled();
});

it('routes an unreadable listing reference to manual review without contacting the model', async () => {
  const { buyer, returnId } = await fixture();
  await submit(buyer.accessToken, returnId);
  imageGet.mockRejectedValueOnce(new Error('Listing object unavailable'));
  await inspectReturnCase(returnId);
  const row = await prisma.return.findUniqueOrThrow({ where: { returnId }, include: { inspection: true } });
  expect(row.status).toBe('MANUAL_REVIEW');
  expect(row.inspection?.outcome).toBe('COMPARISON_FAILED');
  expect(row.inspection?.confidence).toBeNull();
  expect(aiPost).not.toHaveBeenCalled();
});

it('requires one return photo per listing reference and snapshots those references', async () => {
  const { buyer, product, returnId } = await fixture();
  await prisma.returnImage.deleteMany({ where: { returnId, storageKey: { contains: 'photo-1' } } });
  const rejected = await request(app).post(`/api/v1/returns/${returnId}/submit`)
    .set('Authorization', `Bearer ${buyer.accessToken}`);
  expect(rejected.status).toBe(422);
  await prisma.returnImage.create({ data: { returnId, cdnUrl: '', storageKey: 'returns/second.png' } });
  await submit(buyer.accessToken, returnId);
  const snapshot = await prisma.returnInspection.findUniqueOrThrow({ where: { returnId } });
  expect(snapshot.predictions).toMatchObject({ referenceImages: [{ id: expect.any(String) }, { id: expect.any(String) }] });
  expect(await prisma.productImage.count({ where: { productId: product.productId } })).toBe(2);
});

it('routes malformed model output and provider failure to manual review', async () => {
  const first = await fixture();
  await submit(first.buyer.accessToken, first.returnId);
  aiPost.mockResolvedValueOnce({ data: { status: 'APPROVED' } } as never);
  await inspectReturnCase(first.returnId);
  const firstRow = await prisma.return.findUniqueOrThrow({ where: { returnId: first.returnId }, include: { inspection: true } });
  expect(firstRow.status).toBe('MANUAL_REVIEW');
  expect(firstRow.inspection?.state).toBe('FAILED');
  const second = await fixture();
  await submit(second.buyer.accessToken, second.returnId);
  aiPost.mockRejectedValueOnce(new Error('Model unavailable'));
  await inspectReturnCase(second.returnId);
  const secondRow = await prisma.return.findUniqueOrThrow({ where: { returnId: second.returnId }, include: { inspection: true } });
  expect(secondRow.status).toBe('MANUAL_REVIEW');
  expect(secondRow.inspection?.outcome).toBe('COMPARISON_FAILED');
  expect(secondRow.inspection?.confidence).toBeNull();
  expect(aiPost).toHaveBeenCalledTimes(2);
});

it('recovers an interrupted inspection without contacting the model', async () => {
  const { buyer, returnId } = await fixture();
  await submit(buyer.accessToken, returnId);
  await prisma.returnInspection.update({ where: { returnId }, data: {
    state: 'RUNNING', startedAt: new Date(Date.now() - 10 * 60_000), attempts: 1,
  } });
  expect(await recoverAbandonedInspections()).toBe(1);
  expect(await recoverAbandonedInspections()).toBe(0);
  const row = await prisma.return.findUniqueOrThrow({ where: { returnId }, include: { inspection: true } });
  expect(row.status).toBe('MANUAL_REVIEW');
  expect(row.inspection?.errorCode).toBe('WORKER_INTERRUPTED');
  expect(aiPost).not.toHaveBeenCalled();
});
