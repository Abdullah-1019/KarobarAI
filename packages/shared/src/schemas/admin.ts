import { z } from 'zod';

// Task 3.1 — search is a blind-index EXACT match on phone_bidx/email_bidx (Doc 5 §4.1), never a
// ciphertext scan — known limitation: no partial/fuzzy search is possible over encrypted fields.
export const adminUserSearchQuerySchema = z
  .object({
    role: z.enum(['BUYER', 'SELLER', 'ADMIN', 'SUPPORT']).optional(),
    status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DEACTIVATED']).optional(),
    search: z.string().min(1).optional(),
    cursor: z.string().regex(/^\d+$/).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export type AdminUserSearchQueryInput = z.infer<typeof adminUserSearchQuerySchema>;

// Task 3.3/3.5 — suspend/ban require a mandatory reason (REQ-F-Admin-003); reactivate's reason
// is optional (Assumption #3 — no source document requires one for reactivation).
export const adminSuspendBanSchema = z.object({ reason: z.string().min(1).max(500) }).strict();
export type AdminSuspendBanInput = z.infer<typeof adminSuspendBanSchema>;

export const adminReactivateSchema = z.object({ reason: z.string().min(1).max(500).optional() }).strict();
export type AdminReactivateInput = z.infer<typeof adminReactivateSchema>;

export const adminModerationListQuerySchema = z
  .object({
    status: z.enum(['DRAFT', 'LIVE', 'OUT_OF_STOCK', 'REMOVED']).optional(),
    cursor: z.string().regex(/^\d+$/).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export type AdminModerationListQueryInput = z.infer<typeof adminModerationListQuerySchema>;

// Task 4.3/4.4 — takedown/restore both require a mandatory reason (BR-001 policy reference).
export const adminModerationActionSchema = z.object({ reason: z.string().min(1).max(500) }).strict();
export type AdminModerationActionInput = z.infer<typeof adminModerationActionSchema>;

// Task 5 — same preset/custom shape as analytics.ts's dateRangeQuerySchema, duplicated rather
// than extended (ZodEffects from .refine() isn't extendable) — same conscious minimal-duplication
// choice Feature 10/11 already made for other ~10-line predicates. groupBy is gmv-trend only,
// harmless-unused on the other two report endpoints.
export const adminReportsQuerySchema = z
  .object({
    range: z.enum(['7d', '30d', '3m', 'custom']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    groupBy: z.enum(['seller', 'category']).optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .strict()
  .refine((data) => (data.range ?? '7d') !== 'custom' || (Boolean(data.startDate) && Boolean(data.endDate)), {
    message: 'startDate and endDate are required when range=custom',
    path: ['startDate'],
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end;
    },
    { message: 'startDate must be a valid date on or before endDate', path: ['endDate'] },
  );

export type AdminReportsQueryInput = z.infer<typeof adminReportsQuerySchema>;

// Task 6.3 — {value} is intentionally unvalidated by Zod here (per-key shape varies: number vs.
// object); ConfigValidationSchema-equivalent per-key checks run in the service layer and throw
// BusinessRuleError('INVALID_CONFIG_VALUE') on failure, since that's a business-rule check
// (courier weights summing to 1.0), not a structural shape check Zod's generic 400 fits.
export const adminConfigPatchSchema = z.object({ value: z.unknown(), reason: z.string().min(1).max(500) }).strict();
export type AdminConfigPatchInput = z.infer<typeof adminConfigPatchSchema>;
