import type {
  AiGenerateRequestInput,
  AiGenerateResponseDTO,
  AiGeneratedDraftDTO,
  AiSaveProductInput,
  AiStagedImageDTO,
  AiStagingUploadDTO,
  ProductDetailDTO,
} from '@karobarai/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import axios from 'axios';

import { getStorageAdapter } from '../../adapters/storage';
import { config } from '../../core/config';
import { DependencyError, NotFoundError } from '../../core/errors/AppError';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import { validateImageFile } from '../../core/upload/imageValidation';
import * as catalogService from '../catalog/catalog.service';
import { resolveCategory } from './category-resolution.service';
import * as repo from './ai-store-builder.repository';
import { derivePreview } from './seo-metadata.service';

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — Image Upload & Validation
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadStagingImages(files: Array<{ buffer: Buffer; size: number }>): Promise<AiStagingUploadDTO> {
  // Validate every file before uploading any (mirrors catalog.service.ts's own
  // uploadProductImages precedent) — never let an invalid file reach storage or incur AI cost.
  const mimeTypes = files.map((file) => validateImageFile(file, 'PRODUCT_IMAGE_TOO_LARGE', 'PRODUCT_IMAGE_INVALID_FILE'));

  const stagingId = randomUUID();
  const storage = getStorageAdapter();
  const images: AiStagedImageDTO[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const mimeType = mimeTypes[i];
    if (!file || !mimeType) continue;
    const extension = mimeType.split('/')[1];
    // Task 2.2 — distinct staging prefix, never the final products/{id}/ path (no product
    // exists yet — product_images.product_id is NOT NULL, Doc 5 §4.7).
    const key = `products/staging/${stagingId}/${i}-${randomUUID()}.${extension}`;
    // eslint-disable-next-line no-await-in-loop -- position must stay sequential (0 = primary)
    const { url } = await storage.upload({ buffer: file.buffer, key, contentType: mimeType });
    images.push({ cdnUrl: url, position: i });
  }

  await repo.saveStagingImages(stagingId, images);
  return { stagingId, images };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 3 — AI Request Pipeline
// ─────────────────────────────────────────────────────────────────────────────

// Task 3.3/Assumption #3 — near the 30s user-facing ceiling (REQ-NF-Perf002), leaving headroom
// for network/mapping overhead; the AI Service's own internal per-client budget (GeminiVisionClient:
// 10s timeout x 2 attempts each, both primary and fallback) stays comfortably under this.
const CORE_API_AI_TIMEOUT_MS = 28_000;

// Defensive re-validation of the AI Service's own response at the Core API boundary (Task 1's
// Engineering Decision) — catches any contract drift between services; any shape violation is a
// full failure, never a partially-populated result (Task 3.6).
const generatedListingResponseSchema = z
  .object({
    title_en: z.string(),
    title_ur: z.string(),
    description_en: z.string(),
    description_ur: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
  })
  .strict();

// Checks the error shape directly (code/response.status) rather than axios.isAxiosError() — an
// SDK type-guard function that a whole-module `jest.mock('axios')` (this codebase's established
// mocking convention, e.g. tests/catalog/creation.test.ts) auto-mocks to a no-op, which would
// silently defeat this distinction in tests. Real axios errors carry these same properties
// regardless of whether isAxiosError() is called.
function classifyAiServiceError(err: unknown): { code: string; message: string } {
  const shaped = err as { code?: string; response?: { status?: number } } | null;
  if (shaped?.code === 'ECONNABORTED') {
    return { code: 'AI_GENERATION_TIMEOUT', message: 'AI listing generation timed out' };
  }
  // AI Service's own structured failure (Task 3.1's {error: "GENERATION_FAILED"}, 502) — both
  // its primary and fallback LLM clients failed internally.
  if (shaped?.response?.status === 502) {
    return { code: 'AI_GENERATION_FAILED', message: 'AI listing generation failed' };
  }
  return { code: 'AI_SERVICE_UNAVAILABLE', message: 'AI Service is temporarily unavailable' };
}

async function callAiService(imageUrl: string, hint: string | undefined) {
  try {
    const response = await axios.post(
      `${config.aiServiceUrl}/generate-listing`,
      { image_url: imageUrl, hint },
      { timeout: CORE_API_AI_TIMEOUT_MS },
    );
    return response.data as unknown;
  } catch (err) {
    const { code, message } = classifyAiServiceError(err);
    logger.warn({ err, code }, '[ai-store-builder] AI Service call failed');
    throw new DependencyError(message, undefined, code);
  }
}

// Task 4.2/4.3 — maps the validated AI response into Feature 4's exact draft field shape,
// resolving category (4.1) and truncating over-produced tags (4.3, over-10 truncated to top 10;
// under-5 passed through unmodified, never blocked — REQ-F-Store003 keeps every field editable).
const MAX_TAGS = 10;

async function mapAiResultToDraft(result: z.infer<typeof generatedListingResponseSchema>): Promise<AiGeneratedDraftDTO> {
  const categoryId = await resolveCategory(result.category);
  const tags = result.tags.length > MAX_TAGS ? result.tags.slice(0, MAX_TAGS) : result.tags;
  return {
    titleEn: result.title_en,
    titleUr: result.title_ur,
    descriptionEn: result.description_en,
    descriptionUr: result.description_ur,
    categoryId: categoryId ? categoryId.toString() : null,
    categoryGuess: result.category,
    tags,
    aiGenerated: true,
  };
}

// Task 3.4's Store-Setup-Wizard-completed guard and authenticate/authorize(SELLER) chain are
// enforced at the router level (requireActiveSeller, reused from Feature 3/4 — never reimplemented
// here), so this function can assume it's only ever called for an active, onboarded seller.
export async function generateDraft(input: AiGenerateRequestInput): Promise<AiGenerateResponseDTO> {
  const images = await repo.getStagingImages(input.stagingId);
  if (!images || images.length === 0) {
    throw new NotFoundError('Staging session not found or expired', undefined, 'AI_STAGING_NOT_FOUND');
  }
  const primary = images.find((i) => i.position === 0) ?? images[0];
  if (!primary) {
    throw new NotFoundError('Staging session not found or expired', undefined, 'AI_STAGING_NOT_FOUND');
  }

  const raw = await callAiService(primary.cdnUrl, input.categoryHint);
  const parsed = generatedListingResponseSchema.safeParse(raw);
  if (!parsed.success) {
    // Task 3.6 — a malformed/partial AI Service response is a full failure, never passed
    // through with missing fields.
    logger.warn({ issues: parsed.error.issues }, '[ai-store-builder] AI Service response failed defensive Zod re-validation');
    throw new DependencyError('AI listing generation failed', undefined, 'AI_GENERATION_FAILED');
  }

  const draft = await mapAiResultToDraft(parsed.data);
  const seoPreview = derivePreview(draft.titleEn, draft.descriptionEn);
  return { stagingId: input.stagingId, draft, seoPreview };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 6 — Save Product (reuses Feature 4's ProductService verbatim — see catalog.service.ts's
// createProduct/updateProduct/publishProduct/markAiGenerated/loadOwnedProduct; the only genuinely
// new persistence-adjacent code in this feature is the staged-image-promotion glue below).
// ─────────────────────────────────────────────────────────────────────────────

async function promoteStagedImages(sellerUserId: bigint, productPublicId: string, images: AiStagedImageDTO[]): Promise<bigint> {
  // Task 6.4/Assumption 4 — insert product_images rows pointing at the already-uploaded staging
  // URLs; no physical relocation (neither TRD §28 nor Doc 5 specifies one is required for MVP).
  const product = await catalogService.loadOwnedProduct(sellerUserId, productPublicId);
  await prisma.productImage.createMany({
    data: images.map((img) => ({ productId: product.productId, cdnUrl: img.cdnUrl, position: img.position })),
  });
  return product.productId;
}

export async function saveProduct(sellerUserId: bigint, input: AiSaveProductInput): Promise<ProductDetailDTO> {
  const images = await repo.getStagingImages(input.stagingId);
  if (!images || images.length === 0) {
    throw new NotFoundError('Staging session not found or expired', undefined, 'AI_STAGING_NOT_FOUND');
  }

  // Task 6.1 — assembles Feature 4's expected input from the (possibly seller-edited) draft +
  // stagingId, then calls Feature 4's existing service exactly as its own manual-entry callers
  // do; createProduct + updateProduct together cover the full field set no single Feature 4
  // schema exposes alone (titleEn/price are createProductSchema's NOT NULL minimum; everything
  // else — titleUr/description/tags/stock/condition/category — is updateProductSchema's).
  const created = await catalogService.createProduct(sellerUserId, {
    titleEn: input.titleEn,
    price: input.price,
    categoryId: input.categoryId ?? undefined,
  });

  await catalogService.updateProduct(sellerUserId, created.id, {
    titleUr: input.titleUr,
    descriptionEn: input.descriptionEn,
    descriptionUr: input.descriptionUr,
    stock: input.stock,
    condition: input.condition,
    tags: input.tags,
  });

  const productId = await promoteStagedImages(sellerUserId, created.id, images);

  if (input.aiGenerated) {
    await catalogService.markAiGenerated(sellerUserId, created.id);
  }

  // Task 6.3 — status is DRAFT or LIVE per the seller's chosen action (Publish vs. Save Draft,
  // REQ-F-Store006); LIVE reuses publishProduct()'s existing REQ-F-Store003 validation
  // byte-identically — an AI-path product with an unresolved (null) category is blocked from
  // publishing exactly like a manually-blank one would be, no AI-path exception.
  const finalProduct =
    input.status === 'LIVE'
      ? await catalogService.publishProduct(sellerUserId, created.id)
      : await catalogService.getProductDetailByProductId(productId);

  await repo.deleteStagingImages(input.stagingId);
  return finalProduct;
}
