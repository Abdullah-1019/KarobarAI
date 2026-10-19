import { z } from 'zod';

export const sendBuyerMessageSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  requestId: z.string().uuid().optional(),
  sessionId: z.string().min(8).max(64).optional(),
  locale: z.enum(['en', 'ur']).default('en'),
}).strict();

export type SendBuyerMessageInput = z.infer<typeof sendBuyerMessageSchema>;
