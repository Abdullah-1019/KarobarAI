import { z } from 'zod';

export const sellerMessageSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  sessionId: z.string().min(8).max(64).regex(/^[a-z0-9]+$/i).optional(),
  locale: z.enum(['en', 'ur']).default('en'),
}).strict();

export type SellerMessageInput = z.infer<typeof sellerMessageSchema>;
