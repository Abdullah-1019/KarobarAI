import { z } from 'zod';

export { listNotificationsQuerySchema } from '@karobarai/shared';
export type { ListNotificationsQueryInput } from '@karobarai/shared';

// Task 2.2 — payload validation at the consumer boundary. This is a backend-internal BullMQ job
// envelope, never a client-facing HTTP contract, so it lives here rather than in
// packages/shared's request-schema files. Validates the envelope shape only (userId/type/orderId/
// vars) — malformed/legacy jobs missing a required field are rejected with a clear ZodError
// rather than crashing mid-processing; per-event `vars` content is intentionally not deep-
// validated per event type, since renderTemplate() already degrades gracefully (an unmatched
// `{{var}}` placeholder is left as-is rather than throwing) if a producer omits an optional var.
export const notificationJobSchema = z.object({
  userId: z.string().regex(/^\d+$/),
  type: z.string().min(1),
  orderId: z.string().optional(),
  vars: z.record(z.unknown()),
});

export type NotificationJobPayload = z.infer<typeof notificationJobSchema>;
