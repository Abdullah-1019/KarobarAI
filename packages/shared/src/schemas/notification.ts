import { z } from 'zod';

export const listNotificationsQuerySchema = z
  .object({
    cursor: z.string().regex(/^\d+$/).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export type ListNotificationsQueryInput = z.infer<typeof listNotificationsQuerySchema>;
