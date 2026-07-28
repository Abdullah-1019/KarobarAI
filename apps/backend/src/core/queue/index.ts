import { Queue } from 'bullmq';

import { redis } from '../redis';

// Shared BullMQ connection (TRD §5.1). Individual queues (notifications, tracking-poll,
// ai-dispatch) are created by their owning modules, not here.
export function createQueue(name: string): Queue {
  return new Queue(name, { connection: redis });
}
