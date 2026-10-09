import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

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
}

export interface PublicStorefront {
  store: {
    slug: string;
    publicId: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    policies: { returns: null; shipping: null; payment: null };
  };
  products: PublicStorefrontProduct[];
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
}

export function getPublicStorefront(storeSlug: string): Promise<PublicStorefront> {
  return unwrap(apiClient.get<ApiEnvelope<PublicStorefront>>(`/stores/${encodeURIComponent(storeSlug)}`));
}

export function getStoreForProduct(productPublicId: string): Promise<{ slug: string; name: string }> {
  return unwrap(apiClient.get<ApiEnvelope<{ slug: string; name: string }>>(`/stores/by-product/${encodeURIComponent(productPublicId)}`));
}

export function sendBuyerMessage(
  storeSlug: string,
  input: { message: string; sessionId?: string; locale: 'en' | 'ur' },
): Promise<BuyerChatResponse> {
  return unwrap(apiClient.post<ApiEnvelope<BuyerChatResponse>>(`/stores/${encodeURIComponent(storeSlug)}/chat`, input));
}

export function getBuyerConversation(storeSlug: string, sessionId: string): Promise<{ sessionId: string; messages: BuyerChatMessage[] }> {
  return unwrap(
    apiClient.get<ApiEnvelope<{ sessionId: string; messages: BuyerChatMessage[] }>>(
      `/stores/${encodeURIComponent(storeSlug)}/chat/${encodeURIComponent(sessionId)}`,
    ),
  );
}
