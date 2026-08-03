import type { Worker } from 'bullmq';

import { logger } from '../../core/logger';
import { createWorker } from '../../core/queue';
import { processNotificationEvent } from './notification.service';

// Task 1.3 — a single BullMQ worker entry point, routing by eventType inside
// processNotificationEvent (not one worker per event type). Consumes the exact
// `notifications-pending` queue Feature 8's producer already enqueues into — reuses the shared
// Redis connection (core/queue), no second client instantiated.
let worker: Worker | undefined;

export function startNotificationConsumer(): void {
  worker ??= createWorker('notifications-pending', async (job) => {
    await processNotificationEvent(job.data);
  });
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '[notification] job failed');
  });
}
