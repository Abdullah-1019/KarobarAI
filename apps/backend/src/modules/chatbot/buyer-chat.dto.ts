import { z } from 'zod';

export const sendBuyerMessageSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  requestId: z.string().uuid().optional(),
  sessionId: z.string().min(8).max(64).optional(),
  locale: z.enum(['en', 'ur']).default('en'),
  // Allowlisted assistant mode. Omitted keeps the original local-model behaviour.
  mode: z.enum(['fast', 'slow']).optional(),
  // The product page the chat was opened from; "this product" refers to it. Checked server-side.
  productId: z.string().uuid().optional(),
}).strict();

export type SendBuyerMessageInput = z.infer<typeof sendBuyerMessageSchema>;
