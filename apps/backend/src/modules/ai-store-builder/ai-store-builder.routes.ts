import { Router } from 'express';
import multer from 'multer';

import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { requireActiveSeller } from '../../core/middleware/requireActiveSeller';
import { validateBody } from '../../core/middleware/validate';
import { aiGenerateRequestSchema, aiSaveProductSchema } from './ai-store-builder.dto';
import { generateDraftHandler, saveProductHandler, uploadStagingImagesHandler } from './ai-store-builder.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 10 } });

// Task 1.6/3.4 — authenticate -> authorize(SELLER) -> requireActiveSeller (Feature 3's Store-
// Setup-Wizard-completion guard, reused verbatim from catalog.routes.ts's identical chain) —
// blocks a not-yet-onboarded seller before any upload/AI call, never wasting storage or LLM cost.
export const aiStoreBuilderRouter = Router();
aiStoreBuilderRouter.use(authenticate, authorize('SELLER'), requireActiveSeller);

/**
 * @swagger
 * /api/v1/products/ai-generate/upload:
 *   post:
 *     summary: Validate and stage 1-10 product images (JPEG/PNG/WebP, <=10MB each) before generation
 *     tags: [AI Store Builder]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: "AiStagingUploadDTO — {stagingId, images: [{cdnUrl, position}]}"
 */
aiStoreBuilderRouter.post('/upload', upload.array('images', 10), uploadStagingImagesHandler);

/**
 * @swagger
 * /api/v1/products/ai-generate:
 *   post:
 *     summary: Generate a bilingual listing draft (title/description/category/tags) from a staged image
 *     tags: [AI Store Builder]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "AiGenerateResponseDTO — {stagingId, draft, seoPreview}. Retry-safe: re-invokes generation against the same stagingId without re-upload."
 *       404:
 *         description: AI_STAGING_NOT_FOUND (expired or unknown stagingId)
 *       503:
 *         description: AI_GENERATION_TIMEOUT | AI_GENERATION_FAILED | AI_SERVICE_UNAVAILABLE (DependencyError — distinguish by error.code, not status)
 */
aiStoreBuilderRouter.post('/', validateBody(aiGenerateRequestSchema), generateDraftHandler);

/**
 * @swagger
 * /api/v1/products/ai-generate/save:
 *   post:
 *     summary: Persist the (possibly seller-edited) draft as a product — Publish or Save Draft
 *     tags: [AI Store Builder]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: ProductDetailDTO
 *       422:
 *         description: PUBLISH_REQUIREMENTS_NOT_MET (status=LIVE missing title/image/category — identical to Feature 4's manual-entry rule)
 */
aiStoreBuilderRouter.post('/save', validateBody(aiSaveProductSchema), saveProductHandler);
