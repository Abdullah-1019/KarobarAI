import { Router } from 'express';
import multer from 'multer';

import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { optionalAuthenticate } from '../../core/middleware/optionalAuthenticate';
import { requireActiveSeller } from '../../core/middleware/requireActiveSeller';
import { validateBody, validateQuery } from '../../core/middleware/validate';
import {
  autocompleteHandler,
  createProductHandler,
  deleteProductHandler,
  generateListingHandler,
  getProductDetailHandler,
  listCategoriesHandler,
  listSellerProductsHandler,
  publishProductHandler,
  removeProductImageHandler,
  reorderProductImagesHandler,
  searchProductsHandler,
  unpublishProductHandler,
  updateProductHandler,
  uploadProductImagesHandler,
} from './catalog.controller';
import {
  autocompleteQuerySchema,
  createProductSchema,
  listSellerProductsQuerySchema,
  reorderImagesSchema,
  searchQuerySchema,
  updateProductSchema,
} from './catalog.dto';
import { getCategoryBySlugHandler, getHomeFeedHandler } from './marketplace.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 10 } });

// ─────────────────────────────────────────────────────────────────────────────
// Public router — no authenticate requirement. Dual-visibility model (Task 1): Guest/Buyer/
// Seller/Admin can all browse LIVE products; product detail additionally allows the owning
// Seller to preview their own Draft (optionalAuthenticate, never a hard 401).
// ─────────────────────────────────────────────────────────────────────────────

export const publicCatalogRouter = Router();

/**
 * @swagger
 * /api/v1/categories:
 *   get:
 *     summary: List all categories as a nested tree (read-only, seeded reference data)
 *     tags: [Catalog]
 *     responses:
 *       200:
 *         description: CategoryDTO[] (root categories with nested children[])
 */
publicCatalogRouter.get('/categories', listCategoriesHandler);

/**
 * @swagger
 * /api/v1/categories/{slug}:
 *   get:
 *     summary: Resolve a category slug to its id/names (Feature 5 Task 3.2 — the /category/:slug route's lookup)
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CategorySummaryDTO
 *       404:
 *         description: Unknown slug (CATEGORY_NOT_FOUND)
 */
publicCatalogRouter.get('/categories/:slug', getCategoryBySlugHandler);

/**
 * @swagger
 * /api/v1/marketplace/home:
 *   get:
 *     summary: Homepage feed — featured + new-arrivals (both recency-proxied, no merchandising field exists) + the cached category tree
 *     tags: [Marketplace]
 *     responses:
 *       200:
 *         description: "HomeFeedDTO: { featured: ProductDetailDTO[], newArrivals: ProductDetailDTO[], categories: CategoryDTO[] }"
 */
publicCatalogRouter.get('/marketplace/home', getHomeFeedHandler);

/**
 * @swagger
 * /api/v1/products/search:
 *   get:
 *     summary: Full-text bilingual product search with filters/sort, public
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: condition
 *         schema: { type: string, enum: [NEW, LIKE_NEW, USED, REFURBISHED] }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [relevance, price_asc, price_desc, newest, rating] }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "{ items: ProductDetailDTO[], nextCursor: string | null }"
 */
publicCatalogRouter.get('/products/search', validateQuery(searchQuerySchema), searchProductsHandler);

/**
 * @swagger
 * /api/v1/products/autocomplete:
 *   get:
 *     summary: Title-match autocomplete suggestions (min 2 chars), public
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: "{ id: string, title: string }[]"
 */
publicCatalogRouter.get('/products/autocomplete', validateQuery(autocompleteQuerySchema), autocompleteHandler);

/**
 * @swagger
 * /api/v1/products/{publicId}:
 *   get:
 *     summary: Public product detail (LIVE only) — the owning Seller may also preview their own Draft
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: ProductDetailDTO
 *       404:
 *         description: Not found — also returned for a non-owner's Draft (avoids leaking existence)
 */
publicCatalogRouter.get('/products/:publicId', optionalAuthenticate, getProductDetailHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Seller-scoped router — authenticate -> authorize(['SELLER']) -> requireActiveSeller (hasStore +
// status=ACTIVE) applied once at the router level (Task 1.4), never per-route. Ownership
// (seller_id === req.sellerContext.userId) is checked inline in catalog.service.ts per handler.
// ─────────────────────────────────────────────────────────────────────────────

export const sellerProductRouter = Router();
sellerProductRouter.use(authenticate, authorize('SELLER'), requireActiveSeller);

/**
 * @swagger
 * /api/v1/seller/products:
 *   get:
 *     summary: The authenticated seller's own product list (paginated, status filter)
 *     tags: [Catalog]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: SellerProductListDTO
 *   post:
 *     summary: Create a Draft product (Task 3.3 — before AI generation runs)
 *     tags: [Catalog]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               titleEn: { type: string }
 *               price: { type: number }
 *               categoryId: { type: string }
 *     responses:
 *       201:
 *         description: ProductDetailDTO (status DRAFT)
 */
sellerProductRouter.get('/', validateQuery(listSellerProductsQuerySchema), listSellerProductsHandler);
sellerProductRouter.post('/', validateBody(createProductSchema), createProductHandler);

/**
 * @swagger
 * /api/v1/seller/products/{productId}/generate-listing:
 *   post:
 *     summary: Orchestrate AI listing generation for a Draft product (mock stub — see handoff doc)
 *     tags: [Catalog]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated ProductDetailDTO with AI-generated fields
 *       400:
 *         description: No image uploaded yet (PRODUCT_IMAGE_REQUIRED)
 *       422:
 *         description: Product is not in DRAFT status (PRODUCT_NOT_DRAFT)
 *       503:
 *         description: ai-service unavailable/failed (AI_GENERATION_FAILED) — row left untouched
 */
sellerProductRouter.post('/:productId/generate-listing', generateListingHandler);

/**
 * @swagger
 * /api/v1/seller/products/{productId}/publish:
 *   post:
 *     summary: DRAFT -> LIVE, gated on title + >=1 image + category (REQ-F-Store003)
 *     tags: [Catalog]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated ProductDetailDTO (status LIVE)
 *       422:
 *         description: Publish requirements not met (PUBLISH_REQUIREMENTS_NOT_MET, details.missing lists exactly what)
 */
sellerProductRouter.post('/:productId/publish', publishProductHandler);

/**
 * @swagger
 * /api/v1/seller/products/{productId}/unpublish:
 *   post:
 *     summary: Explicit LIVE -> DRAFT (distinct from the system-derived OUT_OF_STOCK transition)
 *     tags: [Catalog]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated ProductDetailDTO (status DRAFT)
 *       422:
 *         description: Product was not Live (ALREADY_UNPUBLISHED)
 */
sellerProductRouter.post('/:productId/unpublish', unpublishProductHandler);

/**
 * @swagger
 * /api/v1/seller/products/{productId}:
 *   patch:
 *     summary: Edit product fields (status is never directly writable here — Task 6.2)
 *     tags: [Catalog]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated ProductDetailDTO
 *       403:
 *         description: Product belongs to another seller (PRODUCT_NOT_OWNED)
 *   delete:
 *     summary: Soft-delete (order history is preserved independently via order_items snapshots)
 *     tags: [Catalog]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "{ deleted: true }"
 */
sellerProductRouter.patch('/:productId', validateBody(updateProductSchema), updateProductHandler);
sellerProductRouter.delete('/:productId', deleteProductHandler);

/**
 * @swagger
 * /api/v1/seller/products/{productId}/images:
 *   post:
 *     summary: Upload one or more product images (first upload = position 0 = primary)
 *     tags: [Catalog]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Updated ProductDetailDTO with the new image(s)
 */
sellerProductRouter.post('/:productId/images', upload.array('images', 10), uploadProductImagesHandler);

/**
 * @swagger
 * /api/v1/seller/products/{productId}/images/{imageId}:
 *   delete:
 *     summary: Remove an image; remaining images re-sequence to stay contiguous from 0
 *     tags: [Catalog]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated ProductDetailDTO
 *       404:
 *         description: Image not found on this product (PRODUCT_IMAGE_NOT_FOUND)
 */
sellerProductRouter.delete('/:productId/images/:imageId', removeProductImageHandler);

/**
 * @swagger
 * /api/v1/seller/products/{productId}/images/reorder:
 *   patch:
 *     summary: Reorder images (drag-to-reorder) — must be a full permutation of existing image IDs
 *     tags: [Catalog]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               imageIds: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Updated ProductDetailDTO with new image order
 *       400:
 *         description: Malformed/partial permutation (REORDER_INVALID)
 */
sellerProductRouter.patch('/:productId/images/reorder', validateBody(reorderImagesSchema), reorderProductImagesHandler);
