import axios from 'axios';
import request from 'supertest';

import { config } from '../../src/core/config';
import { prisma } from '../../src/core/prisma';
import { redis } from '../../src/core/redis';
import { app } from '../../src/server';
import { closeNotificationQueue } from '../../src/modules/notification';
import { closeReturnInspectionResources, enqueueReturnInspection,
  inspectReturnCase, startReturnInspectionWorker } from '../../src/modules/returns/return-inspection.service';
import { readPrivateEvidence } from '../../src/modules/returns/private-evidence.storage';
import { createTestOrder, createTestProduct, createTestUser } from '../helpers/factories';
import { resetDb, resetRedis } from '../helpers/reset';

jest.mock('../../src/modules/returns/private-evidence.storage', () => ({ readPrivateEvidence: jest.fn() }));

const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const imageGet = jest.spyOn(axios, 'get');
const aiPost = jest.spyOn(axios, 'post');

beforeEach(async () => {
  await resetDb();
  await resetRedis();
  config.returnDecisions.enabled = true;
  config.returnDecisions.acceptThreshold = 0.8;
  config.returnDecisions.reviewThreshold = 0.6;
  imageGet.mockReset().mockResolvedValue({ data: png, headers: { 'content-type': 'image/png' } } as never);
  aiPost.mockReset();
  jest.mocked(readPrivateEvidence).mockReset().mockResolvedValue({ buffer: png, contentType: 'image/png' });
});

afterAll(async () => {
  await closeReturnInspectionResources();
  await closeNotificationQueue();
  await prisma.$disconnect();
  await redis.quit();
  imageGet.mockRestore();
  aiPost.mockRestore();
});

async function waitForDecision(returnId: bigint, expected: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW') {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const row = await prisma.return.findUniqueOrThrow({ where: { returnId },
      include: { inspection: true } });
    if (row.status === expected && row.inspection?.state === 'COMPLETE') return row;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Inspection job did not persist ${expected}`);
}

it.each([
  [0.998, 'LIKELY_MATCH', 'HIGH_SIMILARITY', 'APPROVED'],
  [0.800, 'LIKELY_MATCH', 'HIGH_SIMILARITY', 'APPROVED'],
  [0.799, 'POSSIBLE_MISMATCH', 'AMBIGUOUS_SIMILARITY', 'MANUAL_REVIEW'],
  [0.600, 'POSSIBLE_MISMATCH', 'AMBIGUOUS_SIMILARITY', 'MANUAL_REVIEW'],
  [0.599, 'POSSIBLE_MISMATCH', 'LOW_SIMILARITY', 'REJECTED'],
  [0.439, 'POSSIBLE_MISMATCH', 'LOW_SIMILARITY', 'REJECTED'],
] as const)('real BullMQ worker persists %s as %s and buyer API returns it', async (score, outcome, reason, expected) => {
  const seller = await createTestUser('SELLER', { onboarded: true });
  const buyer = await createTestUser('BUYER');
  const product = await createTestProduct(seller.userId);
  const reference = await prisma.productImage.create({ data: { productId: product.productId,
    position: 0, cdnUrl: `${config.storage.publicBaseUrl}/${config.storage.bucket}/worker-reference.png` } });
  const order = await createTestOrder(buyer.userId, seller.userId, product,
    { status: 'COMPLETED', deliveredAt: new Date(), buyerConfirmedAt: new Date() });
  const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.orderId } });
  const ret = await prisma.return.create({ data: { orderId: order.orderId, sellerId: seller.userId,
    orderItemId: orderItem.orderItemId, reason: 'NOT_AS_DESCRIBED', status: 'UNDER_AI_REVIEW' } });
  await prisma.returnImage.create({ data: { returnId: ret.returnId,
    cdnUrl: '', storageKey: `returns/${ret.returnId}/photo.png` } });
  await prisma.returnInspection.create({ data: { returnId: ret.returnId, state: 'PENDING',
    policyVersion: 'dinov2_comparison_v1', predictions: { referenceImages: [
      { id: reference.imageId.toString(), url: reference.cdnUrl },
    ] } } });

  aiPost.mockResolvedValueOnce({ data: {
    provider: 'dinov2', model: 'facebook/dinov2-small',
    revision: 'ed25f3a31f01632728cabb09d1542f84ab7b0056',
    policy_version: 'dinov2_comparison_v1', status: outcome, similarity_score: score,
    reference_image_count: 1, return_image_count: 1,
    pairs: [{ index: 1, similarity_score: score }], evidence_sufficient: true,
    reason_code: reason, processed_at: new Date().toISOString(),
  } } as never);

  startReturnInspectionWorker();
  await enqueueReturnInspection(ret.returnId);
  const saved = await waitForDecision(ret.returnId, expected);
  expect(saved.decision).toBe(expected === 'MANUAL_REVIEW' ? null : expected);
  expect(saved.inspection?.predictions).toMatchObject({ aiDecision: { status: expected,
    similarityScore: score, acceptThreshold: 0.8, reviewThreshold: 0.6 } });
  const buyerDetail = await request(app).get(`/api/v1/returns/${ret.returnId}`)
    .set('Authorization', `Bearer ${buyer.accessToken}`);
  expect(buyerDetail.status).toBe(200);
  expect(buyerDetail.body.data.status).toBe(expected);
  expect(buyerDetail.body.data.decisionSource).toBe(expected === 'MANUAL_REVIEW' ? null : 'AI');
  expect(buyerDetail.body.data.inspection.aiDecision).toBeNull();
  expect(buyerDetail.body.data.inspection.provider).toBeNull();
  const sellerDetail = await request(app).get(`/api/v1/seller/returns/${ret.returnId}`)
    .set('Authorization', `Bearer ${seller.accessToken}`);
  expect(sellerDetail.body.data.inspection.aiDecision.reason).toBe(
    expected === 'MANUAL_REVIEW' ? 'UNCERTAIN_SIMILARITY' : reason);
  await inspectReturnCase(ret.returnId);
  expect(await prisma.auditLog.count({ where: { entity: 'returns', entityId: ret.returnId,
    reason: { startsWith: 'Automated return decision:' } } })).toBe(1);
});
