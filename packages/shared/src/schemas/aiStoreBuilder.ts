import { z } from 'zod';

const conditionSchema = z.enum(['NEW', 'LIKE_NEW', 'USED', 'REFURBISHED']);

export const aiStagedImageSchema = z.object({ cdnUrl: z.string().min(1), position: z.number().int().min(0) }).strict();

// Task 3 — exactly {stagingId, categoryHint?} per the module doc's own Expected Deliverables.
// The doc's Task 2.4 ("frontend carries forward" the images array) and Task 3.2 ("resolves
// stagingId -> cdnUrl") read as mutually exclusive without a server-side staging store — resolved
// by keeping one, TTL'd in Redis (staging:{stagingId} -> images[]), set by Task 2's upload
// endpoint and read here and in Task 6's save. No new Postgres table (schema stays frozen); see
// the handoff doc for the full reasoning.
export const aiGenerateRequestSchema = z
  .object({
    stagingId: z.string().min(1),
    categoryHint: z.string().max(200).optional(),
  })
  .strict();

export type AiGenerateRequestInput = z.infer<typeof aiGenerateRequestSchema>;

// Task 6.2 — the final save payload: AI draft fields (possibly seller-edited) + price/stock
// (never AI-generated, REQ-AI-Store002's schema has no price field) + stagingId (image
// promotion) + status (Publish vs. Save Draft, REQ-F-Store006) + an explicit aiGenerated flag
// (Assumption: this endpoint doubles as the manual-entry fallback per REQ-F-Store005, so
// provenance can't be inferred server-side from the mere presence of a stagingId — see handoff).
export const aiSaveProductSchema = z
  .object({
    stagingId: z.string().min(1),
    titleEn: z.string().min(1).max(160),
    titleUr: z.string().max(160).nullable().optional(),
    descriptionEn: z.string().nullable().optional(),
    descriptionUr: z.string().nullable().optional(),
    price: z.number().nonnegative(),
    stock: z.number().int().min(0).optional(),
    condition: conditionSchema.optional(),
    categoryId: z.string().regex(/^\d+$/, 'categoryId must be numeric').nullable().optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(['DRAFT', 'LIVE']),
    aiGenerated: z.boolean(),
  })
  .strict();

export type AiSaveProductInput = z.infer<typeof aiSaveProductSchema>;
