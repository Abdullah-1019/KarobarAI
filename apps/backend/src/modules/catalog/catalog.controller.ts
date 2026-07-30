import { ValidationError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import * as catalogService from './catalog.service';
import type {
  AutocompleteQueryInput,
  CreateProductInput,
  ListSellerProductsQueryInput,
  ReorderImagesInput,
  SearchQueryInput,
  UpdateProductInput,
} from './catalog.dto';

// ─────────────────────────────────────────────────────────────────────────────
// Public routes
// ─────────────────────────────────────────────────────────────────────────────

export const listCategoriesHandler = asyncHandler(async (_req, res) => {
  const categories = await catalogService.listCategories();
  res.status(200).json(ok(categories));
});

export const getProductDetailHandler = asyncHandler(async (req, res) => {
  const product = await catalogService.getProductDetail(req.params.publicId ?? '', req.user?.sub ?? null);
  res.status(200).json(ok(product));
});

export const searchProductsHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as SearchQueryInput;
  const result = await catalogService.searchProducts(query);
  res.status(200).json(ok(result));
});

export const autocompleteHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as AutocompleteQueryInput;
  const suggestions = await catalogService.autocompleteProducts(query.q);
  res.status(200).json(ok(suggestions));
});

// ─────────────────────────────────────────────────────────────────────────────
// Seller-scoped routes — req.sellerContext is guaranteed set by requireActiveSeller
// ─────────────────────────────────────────────────────────────────────────────

export const createProductHandler = asyncHandler(async (req, res) => {
  const input = req.body as CreateProductInput;
  const product = await catalogService.createProduct(req.sellerContext!.userId, input);
  res.status(201).json(ok(product));
});

export const generateListingHandler = asyncHandler(async (req, res) => {
  const hint = typeof req.body?.hint === 'string' ? req.body.hint : undefined;
  const product = await catalogService.generateListing(req.sellerContext!.userId, req.params.productId ?? '', hint);
  res.status(200).json(ok(product));
});

export const publishProductHandler = asyncHandler(async (req, res) => {
  const product = await catalogService.publishProduct(req.sellerContext!.userId, req.params.productId ?? '');
  res.status(200).json(ok(product));
});

export const listSellerProductsHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as ListSellerProductsQueryInput;
  const result = await catalogService.listSellerProducts(req.sellerContext!.userId, query);
  res.status(200).json(ok(result));
});

export const updateProductHandler = asyncHandler(async (req, res) => {
  const input = req.body as UpdateProductInput;
  const product = await catalogService.updateProduct(req.sellerContext!.userId, req.params.productId ?? '', input);
  res.status(200).json(ok(product));
});

export const unpublishProductHandler = asyncHandler(async (req, res) => {
  const product = await catalogService.unpublishProduct(req.sellerContext!.userId, req.params.productId ?? '');
  res.status(200).json(ok(product));
});

export const deleteProductHandler = asyncHandler(async (req, res) => {
  await catalogService.deleteProduct(req.sellerContext!.userId, req.params.productId ?? '');
  res.status(200).json(ok({ deleted: true }));
});

export const uploadProductImagesHandler = asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    throw new ValidationError('No files uploaded (expected multipart field "images")', undefined, 'PRODUCT_IMAGE_INVALID_FILE');
  }
  const product = await catalogService.uploadProductImages(
    req.sellerContext!.userId,
    req.params.productId ?? '',
    files.map((file) => ({ buffer: file.buffer, size: file.size })),
  );
  res.status(200).json(ok(product));
});

export const removeProductImageHandler = asyncHandler(async (req, res) => {
  const product = await catalogService.removeProductImage(
    req.sellerContext!.userId,
    req.params.productId ?? '',
    req.params.imageId ?? '',
  );
  res.status(200).json(ok(product));
});

export const reorderProductImagesHandler = asyncHandler(async (req, res) => {
  const input = req.body as ReorderImagesInput;
  const product = await catalogService.reorderProductImages(req.sellerContext!.userId, req.params.productId ?? '', input);
  res.status(200).json(ok(product));
});
