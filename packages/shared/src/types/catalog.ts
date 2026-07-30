import type { ProductCondition, ProductStatus } from '../enums/index';

// Feature 4 (Product Management) DTOs — Schema §4.5-§4.7 (categories/products/product_images).

export interface CategoryDTO {
  id: string; // categoryId as a numeric string (BigInt isn't valid JSON)
  slug: string;
  nameEn: string;
  nameUr: string;
  children: CategoryDTO[];
}

export interface ProductImageDTO {
  id: string;
  url: string;
  position: number;
}

export interface CategorySummaryDTO {
  id: string;
  slug: string;
  nameEn: string;
  nameUr: string;
}

// Public product detail (GET /products/:publicId) and the owner-preview case (Task 3.6).
export interface ProductDetailDTO {
  id: string; // publicId (UUID) — never the internal sequential product_id
  titleEn: string;
  titleUr: string | null;
  descriptionEn: string | null;
  descriptionUr: string | null;
  price: string; // Decimal as string, avoids float precision loss over JSON
  stock: number;
  condition: ProductCondition;
  status: ProductStatus;
  aiGenerated: boolean;
  category: CategorySummaryDTO | null;
  images: ProductImageDTO[];
  createdAt: string;
}

// Seller's own product-list row (GET /seller/products) — lighter than full detail, no need to
// ship every image for a table/grid view (just the primary one, position 0).
export interface SellerProductListItemDTO {
  id: string;
  titleEn: string;
  price: string;
  stock: number;
  condition: ProductCondition;
  status: ProductStatus;
  categoryId: string | null;
  primaryImageUrl: string | null;
  createdAt: string;
}

export interface SellerProductListDTO {
  items: SellerProductListItemDTO[];
  nextCursor: string | null;
}

export interface SearchResultDTO {
  items: ProductDetailDTO[];
  nextCursor: string | null;
}

// REQ-AI-Store002's exact schema — the ai-service /generate-listing contract, mirrored here so
// apps/backend's orchestration layer and apps/ai-service's Pydantic model can't drift apart.
export interface GeneratedListingDTO {
  titleEn: string;
  titleUr: string;
  descriptionEn: string;
  descriptionUr: string;
  category: string; // best-guess category slug; apps/backend resolves this to a real categoryId
  tags: string[];
}
