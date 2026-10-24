import type { ProductDetailDTO, ProductVariantDTO } from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';
import type { ChatMode } from '../ai-chat/chatMode';
import { StreamRouteUnavailableError, streamChat } from '../ai-chat/streamChat';

export interface PublicStorefrontProduct {
  id: string;
  titleEn: string;
  titleUr: string | null;
  descriptionEn: string | null;
  descriptionUr: string | null;
  price: string;
  stock: number;
  imageUrl: string | null;
  category: { slug: string; nameEn: string; nameUr: string } | null;
  variants?: ProductVariantDTO[];
}

export interface PublicStorefront {
  store: {
    slug: string;
    publicId: string;
    name: string;
    description: string | null;
    descriptionUr?: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    category: { id: string; slug: string; nameEn: string; nameUr: string } | null;
    city: string | null;
    memberSince: string;
    socialLinks: Partial<Record<'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'whatsapp' | 'website', string>>;
    policies: { returns: null; shipping: null; payment: null };
  };
  products: PublicStorefrontProduct[];
}

export interface StoreDirectoryItem {
  slug: string;
  name: string;
  description: string | null;
  descriptionUr?: string | null;
  logoUrl: string | null;
  memberSince: string;
  productCount: number;
  category: { id: string; slug: string; nameEn: string; nameUr: string } | null;
  city: string | null;
}

export interface StoreDirectoryResult {
  items: StoreDirectoryItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface StoreDirectoryParams {
  q?: string;
  categorySlug?: string;
  sort?: 'name' | 'newest' | 'most_products';
  page?: number;
  limit?: number;
}

export function getStoreDirectory(params: StoreDirectoryParams = {}): Promise<StoreDirectoryResult> {
  return unwrap(apiClient.get<ApiEnvelope<StoreDirectoryResult>>('/stores', { params }));
}

export function getFeaturedStores(): Promise<StoreDirectoryItem[]> {
  return unwrap(apiClient.get<ApiEnvelope<StoreDirectoryItem[]>>('/stores/featured'));
}

// The storefront endpoint returns a lighter product row than ProductDetailDTO. ProductCard only
// reads a handful of fields, so this maps the row onto the card's shape without inventing data:
// no createdAt is sent, so the "New" badge (recency-derived) simply never shows here, and every
// row the endpoint returns is a live listing.
export function toCardProduct(product: PublicStorefrontProduct): ProductDetailDTO {
  return {
    id: product.id,
    titleEn: product.titleEn,
    titleUr: product.titleUr,
    descriptionEn: product.descriptionEn,
    descriptionUr: product.descriptionUr,
    price: product.price,
    stock: product.stock,
    condition: 'NEW',
    status: 'LIVE',
    aiGenerated: false,
    category: product.category ? { id: product.category.slug, ...product.category } : null,
    images: product.imageUrl ? [{ id: `${product.id}-0`, url: product.imageUrl, position: 0 }] : [],
    variants: product.variants ?? [],
    createdAt: '',
  };
}

export interface BuyerChatMessage {
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

export interface BuyerChatResponse {
  sessionId: string;
  reply: string;
  redirectToCheckout: boolean;
  /** Present when the request chose a mode; true only after the server confirmed a cart change. */
  mode?: ChatMode;
  cartChanged?: boolean;
}

export function getPublicStorefront(storeSlug: string): Promise<PublicStorefront> {
  return unwrap(apiClient.get<ApiEnvelope<PublicStorefront>>(`/stores/${encodeURIComponent(storeSlug)}`));
}

export function getStoreForProduct(productPublicId: string): Promise<{ slug: string; name: string }> {
  return unwrap(apiClient.get<ApiEnvelope<{ slug: string; name: string }>>(`/stores/by-product/${encodeURIComponent(productPublicId)}`));
}

export function sendBuyerMessage(
  storeSlug: string,
  input: { message: string; sessionId?: string; locale: 'en' | 'ur'; requestId?: string; mode?: ChatMode; productId?: string },
  signal?: AbortSignal,
): Promise<BuyerChatResponse> {
  return unwrap(apiClient.post<ApiEnvelope<BuyerChatResponse>>(`/stores/${encodeURIComponent(storeSlug)}/chat`, input, { signal }));
}

export async function streamBuyerMessage(
  storeSlug: string,
  input: { message: string; sessionId?: string; locale: 'en' | 'ur'; requestId?: string; mode?: ChatMode; productId?: string },
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<BuyerChatResponse> {
  try {
    return await streamChat<BuyerChatResponse>(`/stores/${encodeURIComponent(storeSlug)}/chat/stream`, input, onDelta, signal);
  } catch (error) {
    if (!(error instanceof StreamRouteUnavailableError) || signal.aborted) throw error;
    // Older API processes have only the original route and reject the newer requestId field.
    return sendBuyerMessage(storeSlug, { message: input.message, sessionId: input.sessionId, locale: input.locale }, signal);
  }
}

export function getBuyerConversation(storeSlug: string, sessionId: string): Promise<{ sessionId: string; messages: BuyerChatMessage[] }> {
  return unwrap(
    apiClient.get<ApiEnvelope<{ sessionId: string; messages: BuyerChatMessage[] }>>(
      `/stores/${encodeURIComponent(storeSlug)}/chat/${encodeURIComponent(sessionId)}`,
    ),
  );
}
