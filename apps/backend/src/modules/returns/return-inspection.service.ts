import axios from 'axios';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { Worker } from 'bullmq';

import { config } from '../../core/config';
import { toAiServiceImageUrl } from '../catalog/ai-image-url';
import { createAuditLog } from '../../core/audit';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import { createQueue, createWorker } from '../../core/queue';
import { enqueueNotification } from '../notification';
import { readPrivateEvidence } from './private-evidence.storage';
import { decideAutomatedReturn } from './return-decision-engine';

const outcome = z.enum(['LIKELY_MATCH', 'POSSIBLE_MISMATCH', 'INSUFFICIENT_VISUAL_EVIDENCE', 'COMPARISON_FAILED']);
const reasonCode = z.enum(['HIGH_SIMILARITY', 'LOW_SIMILARITY', 'AMBIGUOUS_SIMILARITY', 'CONFLICTING_VIEWS',
  'NO_LISTING_IMAGES', 'LOW_QUALITY_EVIDENCE', 'INVALID_IMAGE', 'MODEL_UNAVAILABLE', 'INFERENCE_FAILED']);
const resultSchema = z.object({
  provider: z.literal('dinov2'),
  model: z.string().trim().min(1).max(100),
  revision: z.string().regex(/^[0-9a-f]{40}$/),
  policy_version: z.literal('dinov2_comparison_v1'),
  status: outcome,
  similarity_score: z.number().min(-1).max(1).nullable(),
  reference_image_count: z.number().int().min(1).max(5),
  return_image_count: z.number().int().min(1).max(5),
  pairs: z.array(z.object({ index: z.number().int().min(1).max(5), similarity_score: z.number().min(-1).max(1) }).strict()).min(1).max(5),
  evidence_sufficient: z.boolean(),
  reason_code: reasonCode,
  processed_at: z.string().min(1),
}).strict();

let queue: ReturnType<typeof createQueue> | undefined;
let worker: Worker<{ returnId: string }> | undefined;
let recoveryTimer: NodeJS.Timeout | undefined;
const queueName = 'return-inspections';

export async function enqueueReturnInspection(returnId: bigint): Promise<void> {
  queue ??= createQueue(queueName);
  await queue.add('inspect-return', { returnId: returnId.toString() }, {
    jobId: `return-${returnId}`, attempts: 1, removeOnComplete: true, removeOnFail: 1000,
  });
}

async function imagePayload(key: string): Promise<{ mime_type: string; data: string }> {
  const image = await readPrivateEvidence(key);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.contentType)) throw new Error('Invalid evidence MIME');
  return { mime_type: image.contentType, data: image.buffer.toString('base64') };
}

async function listingImagePayload(url: string): Promise<{ mime_type: string; data: string }> {
  // Only retrieve URLs generated for this application's configured product-image bucket.
  // Never fetch an arbitrary URL passed by a buyer or supplied in a model response.
  const prefix = `${config.storage.publicBaseUrl.replace(/\/+$/, '')}/${config.storage.bucket}/`;
  if (!url.startsWith(prefix)) throw new Error('Listing image is outside configured storage');
  const internalUrl = toAiServiceImageUrl(url);
  const response = await axios.get<ArrayBuffer>(internalUrl, {
    responseType: 'arraybuffer', timeout: 15_000, maxRedirects: 0, maxContentLength: 8 * 1024 * 1024,
  });
  const mime = String(response.headers['content-type'] ?? '').split(';')[0]?.toLowerCase();
  if (!mime || !['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error('Invalid listing image MIME');
  return { mime_type: mime, data: Buffer.from(response.data).toString('base64') };
}

export async function inspectReturnCase(returnId: bigint, jobId?: string): Promise<void> {
  const claim = await prisma.returnInspection.updateMany({
    where: { returnId, state: 'PENDING' }, data: { state: 'RUNNING', attempts: { increment: 1 }, startedAt: new Date() },
  });
  if (!claim.count) return;
  const ret = await prisma.return.findUnique({
    where: { returnId },
    include: { order: { select: { status: true, buyerConfirmedAt: true, buyerId: true, publicId: true } },
      images: { orderBy: { returnImageId: 'asc' } },
      orderItem: { include: { product: { select: { images: {
        orderBy: [{ position: 'asc' }, { imageId: 'asc' }], take: 5,
        select: { imageId: true, cdnUrl: true },
      } } } } }, inspection: true },
  });
  if (!ret || ret.status !== 'UNDER_AI_REVIEW') return;
  const pendingMetadata = ret.inspection?.predictions;
  const referenceSnapshot = pendingMetadata && typeof pendingMetadata === 'object' && !Array.isArray(pendingMetadata)
    && 'referenceImages' in pendingMetadata && Array.isArray(pendingMetadata.referenceImages)
    ? pendingMetadata.referenceImages : [];
  const references = referenceSnapshot.filter((item): item is { id: string; url: string } =>
    typeof item === 'object' && item !== null && !Array.isArray(item)
    && 'id' in item && typeof item.id === 'string' && 'url' in item && typeof item.url === 'string');

  let result: z.infer<typeof resultSchema> | undefined;
  let status: z.infer<typeof outcome> = 'COMPARISON_FAILED';
  let reason: z.infer<typeof reasonCode> = 'INFERENCE_FAILED';
  let state = 'COMPLETE';
  let errorCode: string | undefined;
  try {
    if (!ret.orderItem || ret.inspection?.policyVersion !== 'dinov2_comparison_v1') {
      state = 'FAILED';
      errorCode = 'LEGACY_OR_MISSING_ORDER_ITEM';
    } else if (!references.length || references.length !== referenceSnapshot.length) {
      status = 'INSUFFICIENT_VISUAL_EVIDENCE';
      reason = 'NO_LISTING_IMAGES';
    } else {
      const returnKeys = ret.images.map((image) => image.storageKey);
      if (returnKeys.length !== references.length || returnKeys.some((key) => !key)) throw new Error('Missing paired return evidence');
      const returnImages = await Promise.all(returnKeys.map((key) => imagePayload(key!)));
      const referenceImages = await Promise.all(references.map((image) => listingImagePayload(image.url)));
      const response = await axios.post<unknown>(`${config.aiServiceUrl}/internal/compare-return-images`, {
        return_images: returnImages, reference_images: referenceImages,
      }, { timeout: 100_000 });
      result = resultSchema.parse(response.data);
      if (result.reference_image_count !== referenceImages.length || result.return_image_count !== returnImages.length
        || result.pairs.length !== referenceImages.length || result.pairs.some((pair, index) => pair.index !== index + 1)
        || !Number.isFinite(Date.parse(result.processed_at))
        || (result.status === 'LIKELY_MATCH' || result.status === 'POSSIBLE_MISMATCH') !== result.evidence_sufficient
        || result.similarity_score === null || result.status === 'COMPARISON_FAILED') throw new Error('Invalid comparison result');
      status = result.status;
      reason = result.reason_code;
    }
  } catch (error) {
    state = 'FAILED';
    const providerReason = axios.isAxiosError(error) && error.response?.status === 422
      ? (error.response.data as { error?: string })?.error : undefined;
    if (providerReason === 'LOW_QUALITY_EVIDENCE' || providerReason === 'INVALID_IMAGE') {
      status = 'INSUFFICIENT_VISUAL_EVIDENCE';
      reason = providerReason;
      state = 'COMPLETE';
    } else {
      status = 'COMPARISON_FAILED';
      reason = 'INFERENCE_FAILED';
      errorCode = 'COMPARISON_UNAVAILABLE';
    }
    logger.warn({ returnId: returnId.toString(), reason }, 'Return comparison requires manual review');
  }

  const policyEligible = Boolean(ret.order.buyerConfirmedAt
    && ret.order.status === 'COMPLETED'
    && ret.createdAt.getTime() >= ret.order.buyerConfirmedAt!.getTime()
    && ret.createdAt.getTime() <= ret.order.buyerConfirmedAt!.getTime() + 86_400_000);
  const decision = decideAutomatedReturn({
    score: result?.similarity_score ?? null,
    pairs: result?.pairs.map((pair) => pair.similarity_score) ?? [],
    referenceCount: references.length,
    returnCount: ret.images.length,
    evidenceSufficient: result?.evidence_sufficient === true,
    comparisonCompleted: state === 'COMPLETE' && result !== undefined,
    policyEligible,
  });
  const targetStatus = decision.decision;
  const completedAt = new Date();
  logger.info({ jobId, returnId: returnId.toString(), score: result?.similarity_score ?? null,
    policyEligible, evidenceSufficient: result?.evidence_sufficient === true,
    acceptThreshold: decision.acceptThreshold, reviewThreshold: decision.reviewThreshold,
    decision: targetStatus, reason: decision.reason }, 'Return inspection decision evaluated');
  const persisted = await prisma.$transaction(async (tx) => {
    // Claim the return's pending status before recording an AI decision. A seller or
    // recovery path may have moved it while inference was running; in that case the
    // comparison can be retained, but it must not claim to have decided the return.
    const changed = await tx.return.updateMany({ where: { returnId, status: 'UNDER_AI_REVIEW' }, data: {
      status: targetStatus,
      ...(targetStatus !== 'MANUAL_REVIEW' ? { decision: targetStatus, decidedAt: completedAt } : {}),
    } });
    const claimed = await tx.returnInspection.updateMany({ where: { returnId, state: 'RUNNING' }, data: {
      state, outcome: status,
      findings: Prisma.JsonNull,
      imageQuality: reason === 'LOW_QUALITY_EVIDENCE' || reason === 'INVALID_IMAGE' ? 'UNCLEAR' : 'NOT_ASSESSED',
      comparisonAvailable: Boolean(references.length),
      comparisonResult: status,
      provider: result?.provider ?? null,
      model: result?.model ?? null,
      categorySlug: ret.orderItem?.categorySlugSnapshot ?? null,
      confidence: result?.similarity_score ?? null,
      predictions: { reasonCode: reason, revision: result?.revision ?? null,
        referenceImageCount: result?.reference_image_count ?? references.length,
        returnImageCount: result?.return_image_count ?? ret.images.length,
        pairs: result?.pairs.map((pair) => ({ index: pair.index, similarityScore: pair.similarity_score })) ?? [],
        referenceImages: references,
        evidenceSufficient: result?.evidence_sufficient ?? false,
        ...(changed.count ? { aiDecision: { status: targetStatus, reason: decision.reason,
          similarityScore: result?.similarity_score ?? null,
          acceptThreshold: decision.acceptThreshold, reviewThreshold: decision.reviewThreshold,
          decidedAt: completedAt.toISOString() } } : {}) },
      errorCode, completedAt,
    } });
    if (!claimed.count) throw new Error('Return inspection claim was lost');
    if (!changed.count) {
      const current = await tx.return.findUniqueOrThrow({ where: { returnId }, select: { status: true } });
      return { status: current.status, applied: false };
    }
    if (targetStatus === 'APPROVED') {
      await tx.returnFulfillment.upsert({ where: { returnId }, create: { returnId }, update: {} });
    }
    await createAuditLog({ actorId: null, action: 'MODERATION', entity: 'returns', entityId: returnId,
      reason: `Automated return decision: ${decision.reason}`,
      before: { status: 'UNDER_AI_REVIEW' }, after: { status: targetStatus,
        score: result?.similarity_score ?? null, acceptThreshold: decision.acceptThreshold,
        reviewThreshold: decision.reviewThreshold },
    }, tx);
    return { status: targetStatus, applied: true };
  });
  logger.info({ jobId, returnId: returnId.toString(), score: result?.similarity_score ?? null,
    decision: targetStatus, persistedStatus: persisted.status, applied: persisted.applied },
  'Return inspection decision persisted');
  if (persisted.applied) {
    if (targetStatus !== 'MANUAL_REVIEW') {
      await enqueueNotification({ userId: ret.order.buyerId.toString(),
        type: 'RETURN_DECISION', orderId: ret.order.publicId,
        vars: { orderId: ret.order.publicId, decision: targetStatus === 'APPROVED' ? 'accepted' : 'rejected', reasonText: '' },
      }).catch(() => undefined);
      await enqueueNotification({ userId: ret.sellerId.toString(),
        type: 'RETURN_SELLER_DECISION', orderId: ret.order.publicId,
        vars: { orderId: ret.order.publicId, decision: targetStatus === 'APPROVED' ? 'accepted' : 'rejected' },
      }, `return-${returnId}-seller-ai-decision`).catch(() => undefined);
    } else {
      await enqueueNotification({ userId: ret.sellerId.toString(), type: 'RETURN_SELLER_REVIEW',
        orderId: ret.order.publicId, vars: { orderId: ret.order.publicId } },
      `return-${returnId}-seller-review`).catch(() => undefined);
    }
  }
}

export function startReturnInspectionWorker(): void {
  logger.info({ enabled: config.returnDecisions.enabled,
    acceptThreshold: config.returnDecisions.acceptThreshold,
    reviewThreshold: config.returnDecisions.reviewThreshold }, 'Return auto-decision policy loaded');
  worker ??= createWorker<{ returnId: string }>(queueName, async (job) => inspectReturnCase(BigInt(job.data.returnId), job.id));
  worker.on('failed', (job) => logger.error({ jobId: job?.id }, 'Return inspection job failed'));
  // A process can die after claiming a case but before recording a provider result.
  // Bound this state; a stalled BullMQ retry will see the completed claim and do nothing.
  void recoverAbandonedInspections().catch(() => logger.error('Return inspection recovery failed'));
  recoveryTimer ??= setInterval(() => {
    void recoverAbandonedInspections().catch(() => logger.error('Return inspection recovery failed'));
  }, 60_000);
  recoveryTimer.unref();
}

export async function recoverAbandonedInspections(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 5 * 60_000);
  const abandoned = await prisma.returnInspection.findMany({
    where: { state: 'RUNNING', startedAt: { lt: cutoff } }, select: { returnId: true }, take: 100,
  });
  let recovered = 0;
  for (const { returnId } of abandoned) {
    const changed = await prisma.$transaction(async (tx) => {
      const claim = await tx.returnInspection.updateMany({
        where: { returnId, state: 'RUNNING', startedAt: { lt: cutoff } },
        data: { state: 'FAILED', outcome: 'COMPARISON_FAILED', comparisonResult: 'COMPARISON_FAILED',
          predictions: { reasonCode: 'INFERENCE_FAILED', evidenceSufficient: false },
          errorCode: 'WORKER_INTERRUPTED', completedAt: now },
      });
      if (!claim.count) return false;
      const routed = await tx.return.updateMany({
        where: { returnId, status: 'UNDER_AI_REVIEW' }, data: { status: 'MANUAL_REVIEW' },
      });
      if (routed.count) await createAuditLog({ actorId: null, action: 'MODERATION', entity: 'returns', entityId: returnId,
        reason: 'Return inspection interrupted; routed to human review',
        before: { status: 'UNDER_AI_REVIEW' }, after: { status: 'MANUAL_REVIEW' },
      }, tx);
      return true;
    });
    if (changed) recovered += 1;
  }
  return recovered;
}

export async function closeReturnInspectionResources(): Promise<void> {
  if (recoveryTimer) { clearInterval(recoveryTimer); recoveryTimer = undefined; }
  if (worker) { await worker.close(); worker = undefined; }
  if (queue) { await queue.close(); queue = undefined; }
}
