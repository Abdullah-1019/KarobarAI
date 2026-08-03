import type { Processor } from 'bullmq';
import { Queue, Worker } from 'bullmq';

import { redis } from '../redis';

// Shared BullMQ connection (TRD §5.1). Individual queues (notifications, tracking-poll,
// ai-dispatch) are created by their owning modules, not here.
export function createQueue(name: string): Queue {
  return new Queue(name, { connection: redis });
}

// Feature 8 — the first consumer in this codebase. `redis` already has `maxRetriesPerRequest:
// null` set (core/redis/index.ts), which BullMQ's Worker requires for its blocking commands.
export function createWorker<T = unknown, R = unknown>(name: string, processor: Processor<T, R>): Worker<T, R> {
  return new Worker<T, R>(name, processor, { connection: redis });
}
