import type {
  CategoryDTO,
  CategorySummaryDTO,
  ProductDetailDTO,
  ProductImageDTO,
  SellerProductListDTO,
} from '@karobarai/shared';
import { Prisma } from '@prisma/client';
import type { Category, Product, ProductCondition, ProductStatus } from '@prisma/client';
import axios from 'axios';
import { randomUUID } from 'node:crypto';

import { getStorageAdapter } from '../../adapters/storage';
import { config } from '../../core/config';
import { BusinessRuleError, ConflictError, DependencyError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/AppError';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import { redis } from '../../core/redis';
import { extractStorageKey, validateImageFile } from '../../core/upload/imageValidation';
import type {
  CreateProductInput,
  ListSellerProductsQueryInput,
  ReorderImagesInput,
  SearchQueryInput,
  UpdateProductInput,
} from './catalog.dto';

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — Category Integration (read-only; categories are seeded reference data, Schema §4.5)
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_CACHE_KEY = 'cache:categories:tree';
const CATEGORY_CACHE_TTL_SECONDS = 300; // TRD §19: categories change rarely, 5-min TTL

function buildCategoryTree(rows: Category[]): CategoryDTO[] {
  const byId = new Map<string, CategoryDTO>();
  for (const row of rows) {
    byId.set(row.categoryId.toString(), {
      id: row.categoryId.toString(),
      slug: row.slug,
      nameEn: row.nameEn,
      nameUr: row.nameUr,
      children: [],
    });
  }

  const roots: CategoryDTO[] = [];
  for (const row of rows) {
    const node = byId.get(row.categoryId.toString());
    if (!node) continue;
    const parent = row.parentId ? byId.get(row.parentId.toString()) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function listCategories(): Promise<CategoryDTO[]> {
  const cached = await redis.get(CATEGORY_CACHE_KEY);
  if (cached) return JSON.parse(cached) as CategoryDTO[];

  const rows = await prisma.category.findMany({ orderBy: { nameEn: 'asc' } });
  const tree = buildCategoryTree(rows);

  await redis.set(CATEGORY_CACHE_KEY, JSON.stringify(tree), 'EX', CATEGORY_CACHE_TTL_SECONDS);
  return tree;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCT_INCLUDE = {
  category: true,
  images: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

function toCategorySummary(category: Category | null): CategorySummaryDTO | null {
  if (!category) return null;
  return { id: category.categoryId.toString(), slug: category.slug, nameEn: category.nameEn, nameUr: category.nameUr };
}

function toImageDTO(image: { imageId: bigint; cdnUrl: string; position: number }): ProductImageDTO {
  return { id: image.imageId.toString(), url: image.cdnUrl, position: image.position };
}

function toProductDetail(product: ProductWithRelations): ProductDetailDTO {
  return {
    id: product.publicId,
    titleEn: product.titleEn,
    titleUr: product.titleUr,
    descriptionEn: product.descriptionEn,
    descriptionUr: product.descriptionUr,
    price: product.price.toString(),
    stock: product.stock,
    condition: product.condition,
    status: product.status,
    aiGenerated: product.aiGenerated,
    category: toCategorySummary(product.category),
    images: product.images.map(toImageDTO),
    createdAt: product.createdAt.toISOString(),
  };
}

async function getProductDetailByProductId(productId: bigint): Promise<ProductDetailDTO> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { productId },
    include: PRODUCT_INCLUDE,
  });
  return toProductDetail(product);
}

// Ownership check (Task 1.4/8.2): existence is checked BEFORE ownership, so a genuinely
// nonexistent product is always 404 regardless of who's asking, while an existing-but-not-owned
// product is 403 (the requester is authenticated; it's the ownership boundary being enforced,
// not existence — Task 8.2's explicit reasoning, distinct from Task 3.6's anonymous-Draft case).
async function loadOwnedProduct(sellerUserId: bigint, productPublicId: string): Promise<Product> {
  const product = await prisma.product.findUnique({ where: { publicId: productPublicId } });
  if (!product || product.deletedAt) {
    throw new NotFoundError('Product not found', undefined, 'PRODUCT_NOT_FOUND');
  }
  if (product.sellerId !== sellerUserId) {
    throw new ForbiddenError('This product does not belong to you', undefined, 'PRODUCT_NOT_OWNED');
  }
  return product;
}

// Task 5.3 — the single shared transition function every stock-mutating path calls (decrement,
// restore, direct seller edit). DRAFT/REMOVED are deliberately untouched — those remain explicit
// seller/system actions, never stock-driven.
async function syncStockDerivedStatus(tx: Prisma.TransactionClient, productId: bigint): Promise<void> {
  const product = await tx.product.findUniqueOrThrow({ where: { productId }, select: { stock: true, status: true } });
  if (product.stock === 0 && product.status === 'LIVE') {
    await tx.product.update({ where: { productId }, data: { status: 'OUT_OF_STOCK' } });
  } else if (product.stock > 0 && product.status === 'OUT_OF_STOCK') {
    await tx.product.update({ where: { productId }, data: { status: 'LIVE' } });
  }
}

async function findCategoryOrThrow(categoryId: bigint): Promise<Category> {
  const category = await prisma.category.findUnique({ where: { categoryId } });
  if (!category) throw new NotFoundError('Category not found', undefined, 'CATEGORY_NOT_FOUND');
  return category;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 3 — Product Creation
// ─────────────────────────────────────────────────────────────────────────────

// titleEn is NOT NULL with no DB default (Schema §4.6) — a Draft can't be created with literally
// zero fields despite App Flow's "upload photo first" framing. Assumption: the seller provides a
// minimal working title upfront; generateListing() below overwrites it (and every other AI field)
// on success, same as any other Draft field.
export async function createProduct(sellerUserId: bigint, input: CreateProductInput): Promise<ProductDetailDTO> {
  let categoryId: bigint | undefined;
  if (input.categoryId) {
    categoryId = BigInt(input.categoryId);
    await findCategoryOrThrow(categoryId);
  }

  const product = await prisma.product.create({
    data: {
      sellerId: sellerUserId,
      titleEn: input.titleEn,
      price: input.price,
      categoryId,
      status: 'DRAFT',
      stock: 0,
    },
    include: PRODUCT_INCLUDE,
  });
  return toProductDetail(product);
}

interface GeneratedListingResponse {
  title_en: string;
  title_ur: string;
  description_en: string;
  description_ur: string;
  category: string;
  tags: string[];
}

// Task 3.4 — orchestrates the server-side-only call to ai-service. Mock stub for this pass (see
// docs/handoffs/F4-catalog-backend.md): ai-service's /generate-listing always returns a fixed,
// schema-conformant response rather than calling a real LLM — the real GPT-4V/GPT-3.5 fallback
// chain is a separate, later task. This function's contract (validate → call → persist-on-
// success, never touch the row on failure) is what that real implementation will run under
// unchanged.
export async function generateListing(
  sellerUserId: bigint,
  productPublicId: string,
  hint?: string,
): Promise<ProductDetailDTO> {
  const product = await loadOwnedProduct(sellerUserId, productPublicId);
  if (product.status !== 'DRAFT') {
    throw new BusinessRuleError('AI generation is only available for Draft products', undefined, 'PRODUCT_NOT_DRAFT');
  }

  const images = await prisma.productImage.findMany({
    where: { productId: product.productId },
    orderBy: { position: 'asc' },
    take: 1,
  });
  if (images.length === 0) {
    throw new ValidationError(
      'At least one image is required before generating a listing',
      undefined,
      'PRODUCT_IMAGE_REQUIRED',
    );
  }

  let generated: GeneratedListingResponse;
  try {
    const response = await axios.post<GeneratedListingResponse>(
      `${config.aiServiceUrl}/generate-listing`,
      { image_url: images[0]?.cdnUrl, hint },
      { timeout: 10_000 },
    );
    generated = response.data;
  } catch (err) {
    // REQ-F-Store005: failure leaves the row untouched (fields stay blank/whatever the seller
    // had) — never destructive on failure, so manual entry remains possible.
    logger.warn({ err }, 'AI listing generation failed');
    throw new DependencyError('AI listing generation is temporarily unavailable', undefined, 'AI_GENERATION_FAILED');
  }

  // AI's category is a best-guess slug — resolved against real categories; if it doesn't match
  // anything, the product's existing categoryId (if any) is left as-is, never clobbered with null.
  const matchedCategory = await prisma.category.findUnique({ where: { slug: generated.category } });

  const updated = await prisma.product.update({
    where: { productId: product.productId },
    data: {
      titleEn: generated.title_en,
      titleUr: generated.title_ur,
      descriptionEn: generated.description_en,
      descriptionUr: generated.description_ur,
      tags: generated.tags,
      categoryId: matchedCategory?.categoryId ?? product.categoryId,
      aiGenerated: true,
    },
    include: PRODUCT_INCLUDE,
  });
  return toProductDetail(updated);
}

// Task 3.5 — REQ-F-Store003: publishing requires title, >=1 image, category. titleEn is
// practically always present (NOT NULL from creation) — checked anyway for defense-in-depth and
// parity with the module doc's literal three-requirement list.
export async function publishProduct(sellerUserId: bigint, productPublicId: string): Promise<ProductDetailDTO> {
  const product = await loadOwnedProduct(sellerUserId, productPublicId);

  const imageCount = await prisma.productImage.count({ where: { productId: product.productId } });

  const missing: string[] = [];
  if (!product.titleEn) missing.push('title');
  if (imageCount === 0) missing.push('image');
  if (!product.categoryId) missing.push('category');

  if (missing.length > 0) {
    throw new BusinessRuleError(
      `Cannot publish: missing ${missing.join(', ')}`,
      { missing },
      'PUBLISH_REQUIREMENTS_NOT_MET',
    );
  }

  const updated = await prisma.product.update({
    where: { productId: product.productId },
    data: { status: 'LIVE' },
    include: PRODUCT_INCLUDE,
  });
  return toProductDetail(updated);
}

// Task 3.6 — public_id only, never the internal sequential product_id. A Draft is 404 (not 403)
// for anonymous/non-owner callers — avoids leaking existence (Recommended Enhancement, since the
// docs don't specify 404-vs-403 here); the owning Seller may preview their own Draft.
export async function getProductDetail(
  productPublicId: string,
  viewerPublicId: string | null,
): Promise<ProductDetailDTO> {
  const product = await prisma.product.findUnique({
    where: { publicId: productPublicId },
    include: PRODUCT_INCLUDE,
  });
  if (!product || product.deletedAt) {
    throw new NotFoundError('Product not found', undefined, 'PRODUCT_NOT_FOUND');
  }

  let isOwner = false;
  if (viewerPublicId) {
    const viewer = await prisma.user.findUnique({ where: { publicId: viewerPublicId }, select: { userId: true } });
    isOwner = viewer?.userId === product.sellerId;
  }

  // OUT_OF_STOCK is hidden from default SEARCH results (Task 7.3) but remains directly reachable
  // here via its own link (REQ-F-Inv-003's "hidden from default storefront results" only ever
  // meant listing pages, not the detail page itself) — only DRAFT/REMOVED are gated to non-owners.
  const isVisibleToAnyone = product.status === 'LIVE' || product.status === 'OUT_OF_STOCK';
  if (!isVisibleToAnyone && !isOwner) {
    throw new NotFoundError('Product not found', undefined, 'PRODUCT_NOT_FOUND');
  }

  return toProductDetail(product);
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 4 — Image Management
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadProductImages(
  sellerUserId: bigint,
  productPublicId: string,
  files: Array<{ buffer: Buffer; size: number }>,
): Promise<ProductDetailDTO> {
  const product = await loadOwnedProduct(sellerUserId, productPublicId);

  // Validate every file before uploading any — avoids a partial-upload-then-fail state where an
  // earlier file in the batch is already persisted when a later one turns out invalid.
  const mimeTypes = files.map((file) => validateImageFile(file, 'PRODUCT_IMAGE_TOO_LARGE', 'PRODUCT_IMAGE_INVALID_FILE'));

  const existingMax = await prisma.productImage.aggregate({
    where: { productId: product.productId },
    _max: { position: true },
  });
  let nextPosition = (existingMax._max.position ?? -1) + 1;

  const storage = getStorageAdapter();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const mimeType = mimeTypes[i];
    if (!file || !mimeType) continue;
    const extension = mimeType.split('/')[1];
    const key = `products/${product.productId}/${nextPosition}-${randomUUID()}.${extension}`;
    // eslint-disable-next-line no-await-in-loop -- position assignment must stay sequential
    const { url } = await storage.upload({ buffer: file.buffer, key, contentType: mimeType });
    // eslint-disable-next-line no-await-in-loop
    await prisma.productImage.create({ data: { productId: product.productId, cdnUrl: url, position: nextPosition } });
    nextPosition += 1;
  }

  return getProductDetailByProductId(product.productId);
}

// Task 4.3 — removing an image (especially the primary one) re-sequences remaining positions to
// stay contiguous from 0, so the Task 1.2 unique constraint never blocks the next insert and
// "first = primary" is automatically preserved (no separate reassign-primary step needed).
export async function removeProductImage(
  sellerUserId: bigint,
  productPublicId: string,
  imageId: string,
): Promise<ProductDetailDTO> {
  const product = await loadOwnedProduct(sellerUserId, productPublicId);
  const imageIdBig = BigInt(imageId);

  const image = await prisma.productImage.findUnique({ where: { imageId: imageIdBig } });
  if (!image || image.productId !== product.productId) {
    throw new NotFoundError('Image not found', undefined, 'PRODUCT_IMAGE_NOT_FOUND');
  }

  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { imageId: imageIdBig } });
    const remaining = await tx.productImage.findMany({
      where: { productId: product.productId },
      orderBy: { position: 'asc' },
    });
    // Ascending-order shift-down never collides with the unique constraint: each target position
    // was just vacated (the deleted row) or already relinquished by this same loop.
    for (let i = 0; i < remaining.length; i++) {
      const row = remaining[i];
      if (row && row.position !== i) {
        // eslint-disable-next-line no-await-in-loop
        await tx.productImage.update({ where: { imageId: row.imageId }, data: { position: i } });
      }
    }
  });

  const key = extractStorageKey(image.cdnUrl);
  if (key) {
    getStorageAdapter()
      .delete(key)
      .catch((err) => logger.warn({ err }, 'Failed to delete removed product image (non-fatal)'));
  }

  return getProductDetailByProductId(product.productId);
}

// Task 4.4 — accepts a full permutation of the product's existing image IDs. Two-phase update
// (temporary negative positions, then final positions) avoids unique-constraint collisions that
// a direct in-place reorder would hit mid-transaction (e.g. swapping positions 0 and 1 directly).
export async function reorderProductImages(
  sellerUserId: bigint,
  productPublicId: string,
  input: ReorderImagesInput,
): Promise<ProductDetailDTO> {
  const product = await loadOwnedProduct(sellerUserId, productPublicId);

  const existing = await prisma.productImage.findMany({ where: { productId: product.productId } });
  const existingIds = new Set(existing.map((img) => img.imageId.toString()));
  const providedIds = input.imageIds;

  const isValidPermutation =
    providedIds.length === existing.length &&
    new Set(providedIds).size === providedIds.length &&
    providedIds.every((id) => existingIds.has(id));

  if (!isValidPermutation) {
    throw new ValidationError(
      "imageIds must be a complete permutation of the product's existing images",
      undefined,
      'REORDER_INVALID',
    );
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < providedIds.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await tx.productImage.update({ where: { imageId: BigInt(providedIds[i] ?? '0') }, data: { position: -(i + 1) } });
    }
    for (let i = 0; i < providedIds.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await tx.productImage.update({ where: { imageId: BigInt(providedIds[i] ?? '0') }, data: { position: i } });
    }
  });

  return getProductDetailByProductId(product.productId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 5 — Inventory Management (cross-feature contract: Cart & Checkout will call these)
// ─────────────────────────────────────────────────────────────────────────────

// Task 5.1 — atomic, race-safe: a single conditional UPDATE, not read-then-write. Zero affected
// rows means insufficient stock (matches TRD §9's 409 = "oversell" example exactly). No caller
// exists yet — Checkout (a separate feature) will call this at order confirmation.
export async function decrementStock(productId: bigint, quantity: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const result = await tx.product.updateMany({
      where: { productId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (result.count === 0) {
      throw new ConflictError('Insufficient stock', undefined, 'INSUFFICIENT_STOCK');
    }
    await syncStockDerivedStatus(tx, productId);
  });
}

// Task 5.2 — symmetric to decrement, for cancellation/rejected-payment paths. Increments are
// always safe (no lower bound), but re-triggers the OUT_OF_STOCK -> LIVE check.
export async function restoreStock(productId: bigint, quantity: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { productId }, data: { stock: { increment: quantity } } });
    await syncStockDerivedStatus(tx, productId);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 6 — Product Editing
// ─────────────────────────────────────────────────────────────────────────────

export async function listSellerProducts(
  sellerUserId: bigint,
  filters: ListSellerProductsQueryInput,
): Promise<SellerProductListDTO> {
  const limit = filters.limit ?? 20;

  const products = await prisma.product.findMany({
    where: {
      sellerId: sellerUserId,
      deletedAt: null,
      ...(filters.status && { status: filters.status as ProductStatus }),
      ...(filters.cursor && { productId: { lt: BigInt(filters.cursor) } }),
    },
    orderBy: { productId: 'desc' },
    take: limit + 1,
    include: { images: { where: { position: 0 }, take: 1 } },
  });

  const hasMore = products.length > limit;
  const page = hasMore ? products.slice(0, limit) : products;
  const lastItem = page[page.length - 1];

  return {
    items: page.map((p) => ({
      id: p.publicId,
      titleEn: p.titleEn,
      price: p.price.toString(),
      stock: p.stock,
      condition: p.condition,
      status: p.status,
      categoryId: p.categoryId?.toString() ?? null,
      primaryImageUrl: p.images[0]?.cdnUrl ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    nextCursor: hasMore && lastItem ? lastItem.productId.toString() : null,
  };
}

// Task 6.2 — reuses the create schema's field validators (via the shared updateProductSchema,
// which extends the same rules); status is deliberately never a field the caller can set — it
// only ever changes via publish/unpublish/stock-sync/delete (Task 6.2's core guarantee).
export async function updateProduct(
  sellerUserId: bigint,
  productPublicId: string,
  input: UpdateProductInput,
): Promise<ProductDetailDTO> {
  const product = await loadOwnedProduct(sellerUserId, productPublicId);

  let categoryId: bigint | null | undefined;
  if (input.categoryId !== undefined) {
    if (input.categoryId === null) {
      categoryId = null;
    } else {
      categoryId = BigInt(input.categoryId);
      await findCategoryOrThrow(categoryId);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { productId: product.productId },
      data: {
        ...(input.titleEn !== undefined && { titleEn: input.titleEn }),
        ...(input.titleUr !== undefined && { titleUr: input.titleUr }),
        ...(input.descriptionEn !== undefined && { descriptionEn: input.descriptionEn }),
        ...(input.descriptionUr !== undefined && { descriptionUr: input.descriptionUr }),
        ...(input.price !== undefined && { price: input.price }),
        ...(input.stock !== undefined && { stock: input.stock }),
        ...(input.condition !== undefined && { condition: input.condition as ProductCondition }),
        ...(categoryId !== undefined && { categoryId }),
        ...(input.tags !== undefined && { tags: input.tags }),
      },
    });
    if (input.stock !== undefined) {
      await syncStockDerivedStatus(tx, product.productId);
    }
  });

  return getProductDetailByProductId(product.productId);
}

// Task 6.3 — deliberate LIVE -> DRAFT action, distinct from the automatic stock-driven
// OUT_OF_STOCK state. Re-publishing goes back through publishProduct(), re-validating the gate.
export async function unpublishProduct(sellerUserId: bigint, productPublicId: string): Promise<ProductDetailDTO> {
  const product = await loadOwnedProduct(sellerUserId, productPublicId);
  if (product.status !== 'LIVE') {
    throw new BusinessRuleError('Only a Live product can be unpublished', undefined, 'ALREADY_UNPUBLISHED');
  }

  const updated = await prisma.product.update({
    where: { productId: product.productId },
    data: { status: 'DRAFT' },
    include: PRODUCT_INCLUDE,
  });
  return toProductDetail(updated);
}

// Task 6.4 — soft-delete only; order_items -> products is RESTRICT (Schema §5), so hard delete
// would violate that FK regardless — soft-delete is the only viable mechanism, not just a UX
// choice. No active-order pre-check is needed: soft-delete never touches the RESTRICT-protected
// FK at all, and order_items.title_snapshot/unit_price already preserve history independently.
export async function deleteProduct(sellerUserId: bigint, productPublicId: string): Promise<void> {
  const product = await loadOwnedProduct(sellerUserId, productPublicId);
  // Both fields together, not deletedAt alone — status: REMOVED is the enum's dedicated lifecycle
  // value for this state (Schema §3), so callers can reason from `status` without also having to
  // separately check `deletedAt` everywhere.
  await prisma.product.update({
    where: { productId: product.productId },
    data: { deletedAt: new Date(), status: 'REMOVED' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 7 — Product Search
// ─────────────────────────────────────────────────────────────────────────────

export async function searchProducts(query: SearchQueryInput): Promise<{ items: ProductDetailDTO[]; nextCursor: string | null }> {
  const limit = query.limit ?? 20;
  const cursor = query.cursor ? BigInt(query.cursor) : undefined;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`status = 'LIVE'::product_status`,
    Prisma.sql`deleted_at IS NULL`,
  ];
  if (query.q) {
    conditions.push(Prisma.sql`search_vector @@ plainto_tsquery('simple', unaccent(${query.q}))`);
  }
  if (query.categoryId) {
    conditions.push(Prisma.sql`category_id = ${BigInt(query.categoryId)}`);
  }
  if (query.minPrice !== undefined) {
    conditions.push(Prisma.sql`price >= ${query.minPrice}`);
  }
  if (query.maxPrice !== undefined) {
    conditions.push(Prisma.sql`price <= ${query.maxPrice}`);
  }
  if (query.condition) {
    conditions.push(Prisma.sql`condition = ${query.condition}::product_condition`);
  }
  if (cursor !== undefined) {
    conditions.push(Prisma.sql`product_id < ${cursor}`);
  }

  const whereSql = Prisma.join(conditions, ' AND ');

  // "rating" sort/filter is a documented no-op (Feature Overview Gap — Reviews is R1.1): falls
  // back to relevance silently rather than erroring, per REQ-NF-Safety-003/004.
  const orderBySql =
    query.sort === 'price_asc'
      ? Prisma.sql`price ASC, product_id DESC`
      : query.sort === 'price_desc'
        ? Prisma.sql`price DESC, product_id DESC`
        : query.sort === 'newest'
          ? Prisma.sql`created_at DESC, product_id DESC`
          : query.q
            ? Prisma.sql`ts_rank(search_vector, plainto_tsquery('simple', unaccent(${query.q}))) DESC, product_id DESC`
            : Prisma.sql`created_at DESC, product_id DESC`;

  const rows = await prisma.$queryRaw<Array<{ product_id: bigint }>>(
    Prisma.sql`SELECT product_id FROM products WHERE ${whereSql} ORDER BY ${orderBySql} LIMIT ${limit + 1}`,
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const ids = page.map((r) => r.product_id);

  const products = await prisma.product.findMany({
    where: { productId: { in: ids } },
    include: PRODUCT_INCLUDE,
  });
  const byId = new Map(products.map((p) => [p.productId.toString(), p]));
  const ordered = ids
    .map((id) => byId.get(id.toString()))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const lastRow = page[page.length - 1];
  return {
    items: ordered.map(toProductDetail),
    nextCursor: hasMore && lastRow ? lastRow.product_id.toString() : null,
  };
}

// Task 7.4 — Engineering Decision: ILIKE-equivalent prefix/substring match (Prisma's `contains` +
// insensitive mode) rather than a tsquery-prefix query, since Schema §7 only specifies the
// full-search shape and the module doc explicitly permits either approach for autocomplete.
export async function autocompleteProducts(q: string): Promise<Array<{ id: string; title: string }>> {
  const products = await prisma.product.findMany({
    where: {
      status: 'LIVE',
      deletedAt: null,
      OR: [{ titleEn: { contains: q, mode: 'insensitive' } }, { titleUr: { contains: q, mode: 'insensitive' } }],
    },
    select: { publicId: true, titleEn: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });
  return products.map((p) => ({ id: p.publicId, title: p.titleEn }));
}
