import { z } from 'zod';

export const listNotificationsQuerySchema = z
  .object({
    cursor: z.string().regex(/^\d+$/).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export type ListNotificationsQueryInput = z.infer<typeof listNotificationsQuerySchema>;

// Bulk "mark read" — everything unread (no filter), one section's notifications (`category`),
// and/or one order's (`orderId`). Lets a section's nav dot clear once its page is opened.
export const markNotificationsReadSchema = z
  .object({
    category: z.enum(['orders', 'returns']).optional(),
    orderId: z.string().uuid().optional(),
  })
  .strict();

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
