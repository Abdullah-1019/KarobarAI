import { z } from 'zod';

// Shared between apps/backend and apps/frontend (TRD §4), same convention as ./auth.ts and
// ./profile.ts.

const conditionSchema = z.enum(['NEW', 'LIKE_NEW', 'USED', 'REFURBISHED']);

// Task 3.3 — titleEn AND price are both NOT NULL with no DB default (Schema §4.6), so a Draft
// can't be created with zero fields at all despite App Flow's "upload photo first" framing.
// Assumption: the seller provides a minimal working title + price upfront; AI generation (3.4)
// overwrites titleEn/titleUr/descriptionEn/descriptionUr/tags/category on success (never price,
// which AI was never asked to generate per REQ-AI-Store002's schema) — same as any Draft field.
export const createProductSchema = z
  .object({
    titleEn: z.string().min(1).max(160),
    price: z.number().nonnegative(),
    categoryId: z.string().regex(/^\d+$/, 'categoryId must be numeric').optional(),
  })
  .strict();

// Task 6.2 — reuses/extends the create schema's field validators rather than redefining them;
// all optional (partial update). `status` is deliberately never a field here — status only ever
// changes via publish/unpublish/stock-sync/delete, never a raw PATCH write (Task 6.2's guarantee).
export const updateProductSchema = z
  .object({
    titleEn: z.string().min(1).max(160).optional(),
    titleUr: z.string().max(160).nullable().optional(),
    descriptionEn: z.string().nullable().optional(),
    descriptionUr: z.string().nullable().optional(),
    price: z.number().nonnegative().optional(),
    stock: z.number().int().min(0).optional(),
    condition: conditionSchema.optional(),
    categoryId: z.string().regex(/^\d+$/, 'categoryId must be numeric').nullable().optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

export const reorderImagesSchema = z
  .object({
    imageIds: z.array(z.string().regex(/^\d+$/, 'imageId must be numeric')).min(1),
  })
  .strict();

export const searchQuerySchema = z
  .object({
    q: z.string().max(200).optional(),
    categoryId: z.string().regex(/^\d+$/).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    condition: conditionSchema.optional(),
    // REQ-F-Browse-003's "seller rating" dimension is accepted but a documented no-op (Feature
    // Overview Gap — Reviews/ratings is R1.1, out of scope for MVP); falls back to relevance
    // silently rather than erroring, per REQ-NF-Safety-003/004's graceful-degradation principle.
    sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'rating']).optional(),
    cursor: z.string().regex(/^\d+$/).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict()
  .refine((data) => data.minPrice === undefined || data.maxPrice === undefined || data.minPrice <= data.maxPrice, {
    message: 'minPrice must be <= maxPrice',
    path: ['minPrice'],
  });

// Assumption (Feature Overview Gap): N=2 characters, a named constant rather than a magic number
// scattered across frontend/backend.
export const AUTOCOMPLETE_MIN_CHARS = 2;

export const autocompleteQuerySchema = z
  .object({
    q: z.string().min(AUTOCOMPLETE_MIN_CHARS).max(200),
  })
  .strict();

// Task 6.1 — GET /seller/products (list) filters.
export const listSellerProductsQuerySchema = z
  .object({
    status: z.enum(['DRAFT', 'LIVE', 'OUT_OF_STOCK', 'REMOVED']).optional(),
    cursor: z.string().regex(/^\d+$/).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ReorderImagesInput = z.infer<typeof reorderImagesSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type AutocompleteQueryInput = z.infer<typeof autocompleteQuerySchema>;
export type ListSellerProductsQueryInput = z.infer<typeof listSellerProductsQuerySchema>;
