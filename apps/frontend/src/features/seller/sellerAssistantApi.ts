import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';
import { StreamRouteUnavailableError, streamChat } from '../ai-chat/streamChat';

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

export function sendSellerAssistantMessage(input: { message: string; sessionId?: string; locale: 'en' | 'ur' }, signal?: AbortSignal): Promise<SellerAssistantResponse> {
  return unwrap(apiClient.post<ApiEnvelope<SellerAssistantResponse>>('/seller/chat', input, { signal }));
}

export async function streamSellerAssistantMessage(input: { message: string; sessionId?: string; locale: 'en' | 'ur'; requestId?: string }, onDelta: (text: string) => void, signal: AbortSignal): Promise<SellerAssistantResponse> {
  try {
    return await streamChat<SellerAssistantResponse>('/seller/chat/stream', input, onDelta, signal);
  } catch (error) {
    if (!(error instanceof StreamRouteUnavailableError) || signal.aborted) throw error;
    return sendSellerAssistantMessage({ message: input.message, sessionId: input.sessionId, locale: input.locale }, signal);
  }
}

export function getSellerAssistantConversation(sessionId: string): Promise<{ sessionId: string; messages: SellerAssistantMessage[] }> {
  return unwrap(apiClient.get<ApiEnvelope<{ sessionId: string; messages: SellerAssistantMessage[] }>>(`/seller/chat/${encodeURIComponent(sessionId)}`));
}
