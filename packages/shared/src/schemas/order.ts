import { z } from 'zod';

// Shared between apps/backend and apps/frontend (TRD §4), same convention as ./cart.ts.

export const listOrdersQuerySchema = z
  .object({
    tab: z.enum(['Pending', 'ConfirmedProcessing', 'Shipped', 'Delivered', 'Cancelled']).optional(),
    cursor: z.string().regex(/^\d+$/).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export type ListOrdersQueryInput = z.infer<typeof listOrdersQuerySchema>;
