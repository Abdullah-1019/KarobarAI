import { z } from 'zod';

export const createReturnSchema = z
  .object({
    orderId: z.string().min(1), // the order's publicId
    reason: z.string().min(1).max(200),
  })
  .strict();

export type CreateReturnInput = z.infer<typeof createReturnSchema>;

// Task 4.3/5.3 — reason is mandatory on REJECTED (REQ-F-Return-006), always mandatory for admin
// (REQ-F-Admin-003) — the admin schema below reuses this shape but tightens reason to always-on.
export const sellerDecisionSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    reason: z.string().min(1).max(500).optional(),
  })
  .strict()
  .refine((data) => data.decision !== 'REJECTED' || Boolean(data.reason), {
    message: 'reason is required when decision is REJECTED',
    path: ['reason'],
  });

export type SellerDecisionInput = z.infer<typeof sellerDecisionSchema>;

export const adminDecisionSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    reason: z.string().min(1).max(500),
  })
  .strict();

export type AdminDecisionInput = z.infer<typeof adminDecisionSchema>;

export const listReturnsQuerySchema = z
  .object({
    status: z.string().optional(),
    cursor: z.string().regex(/^\d+$/).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    // Task 7.2/7.3 — seller/admin only: widens the active-queue endpoint to full history.
    // Harmless-but-unused on the buyer endpoint (Task 7.1 is already all-statuses).
    history: z.enum(['true', 'false']).optional(),
  })
  .strict();

export type ListReturnsQueryInput = z.infer<typeof listReturnsQuerySchema>;
