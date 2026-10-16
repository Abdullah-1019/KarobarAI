import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

export interface SellerAssistantMessage {
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

export interface SellerAssistantResponse {
  sessionId: string;
  reply: string;
  toolCalls: number;
}

export function sendSellerAssistantMessage(input: { message: string; sessionId?: string; locale: 'en' | 'ur' }): Promise<SellerAssistantResponse> {
  return unwrap(apiClient.post<ApiEnvelope<SellerAssistantResponse>>('/seller/chat', input));
}

export function getSellerAssistantConversation(sessionId: string): Promise<{ sessionId: string; messages: SellerAssistantMessage[] }> {
  return unwrap(apiClient.get<ApiEnvelope<{ sessionId: string; messages: SellerAssistantMessage[] }>>(`/seller/chat/${encodeURIComponent(sessionId)}`));
}
