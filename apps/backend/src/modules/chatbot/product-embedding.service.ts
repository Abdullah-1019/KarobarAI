import axios from 'axios';
import { randomUUID } from 'node:crypto';
import type { Job, Worker } from 'bullmq';
import { Prisma } from '@prisma/client';

import { config } from '../../core/config';
import { createQueue, createWorker } from '../../core/queue';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';

const QUEUE_NAME = 'product-embeddings';
const JOB_NAME = 'sync-product-embedding';
let queue: ReturnType<typeof createQueue> | undefined;
let worker: Worker<{ productId: string }> | undefined;

function getQueue(): ReturnType<typeof createQueue> {
  queue ??= createQueue(QUEUE_NAME);
  return queue;
}

export async function enqueueProductEmbeddingSync(productId: bigint): Promise<void> {
  await getQueue().add(JOB_NAME, { productId: productId.toString() }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: 1000,
  });
}

export async function syncProductEmbedding(productId: bigint): Promise<'upserted' | 'deleted' | 'skipped'> {
  const product = await prisma.product.findUnique({
    where: { productId },
    include: { category: { select: { nameEn: true, nameUr: true, slug: true } } },
  });
  if (!product || product.status !== 'LIVE' || product.deletedAt) {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "product_embeddings" WHERE "product_id" = ${productId}`);
    return 'deleted';
  }

  const source = buildProductEmbeddingSource(product);
  const result = await axios.post<{ embeddings: number[][] }>(
    `${config.aiServiceUrl}/internal/embeddings`,
    { texts: [source] },
    { timeout: 600_000 },
  );
  const vector = result.data.embeddings?.[0];
  if (!vector || vector.length !== 768 || vector.some((value) => !Number.isFinite(value))) {
    throw new Error('Embedding service returned an invalid vector');
  }

  const current = await prisma.product.findUnique({
    where: { productId },
    select: { status: true, deletedAt: true, updatedAt: true },
  });
  if (!current || current.status !== 'LIVE' || current.deletedAt || current.updatedAt.getTime() !== product.updatedAt.getTime()) {
    await enqueueProductEmbeddingSync(productId);
    return 'skipped';
  }

  const vectorLiteral = `[${vector.join(',')}]`;
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "product_embeddings" ("id", "product_id", "embedding", "updated_at")
    VALUES (${randomUUID()}, ${productId}, ${vectorLiteral}::vector, NOW())
    ON CONFLICT ("product_id") DO UPDATE SET
      "embedding" = EXCLUDED."embedding",
      "updated_at" = NOW()
  `);
  return 'upserted';
}

export function buildProductEmbeddingSource(product: {
  titleEn: string;
  titleUr: string | null;
  descriptionEn: string | null;
  descriptionUr: string | null;
  tags: Prisma.JsonValue;
  category: { nameEn: string; nameUr: string; slug: string } | null;
}): string {
  const tags = Array.isArray(product.tags) ? product.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  return [
    `Title: ${product.titleEn}`,
    product.titleUr && `Urdu title: ${product.titleUr}`,
    product.descriptionEn && `Description: ${product.descriptionEn}`,
    product.descriptionUr && `Urdu description: ${product.descriptionUr}`,
    product.category && `Category: ${product.category.nameEn} / ${product.category.nameUr} (${product.category.slug})`,
    tags.length > 0 && `Tags: ${tags.join(', ')}`,
  ].filter(Boolean).join('\n');
}

export function startProductEmbeddingWorker(): void {
  worker ??= createWorker<{ productId: string }>(QUEUE_NAME, async (job: Job<{ productId: string }>) => {
    const outcome = await syncProductEmbedding(BigInt(job.data.productId));
    logger.info({ productId: job.data.productId, outcome }, 'product embedding synchronized');
  });
  worker.on('failed', (job, error) => logger.error({ jobId: job?.id, err: error }, 'product embedding job failed'));
}

export async function closeProductEmbeddingResources(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
  if (queue) {
    await queue.close();
    queue = undefined;
  }
}

export async function resetProductEmbeddingResourcesForTests(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
  if (queue) {
    await queue.drain(true);
    await queue.close();
    queue = undefined;
  }
}
