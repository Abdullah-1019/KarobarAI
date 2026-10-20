import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

export interface HumanMessage {
  id: string;
  mine: boolean;
  content: string;
  createdAt: string;
  seen: boolean;
  status?: 'SENT' | 'DELIVERED' | 'SEEN';
  deliveredAt?: string | null;
  attachments: { id: string; mimeType: string; byteSize: number }[];
}
export interface HumanConversation {
  id: string;
  storeName: string;
  storeSlug: string;
  buyerName?: string | null;
  blocked: boolean;
  unreadCount: number;
  lastMessage: HumanMessage | null;
  lastMessageAt: string;
}
export interface HumanConversationList { items: HumanConversation[]; page: number; limit: number; total: number; hasMore: boolean }
export interface HumanMessagePage { conversation: Pick<HumanConversation, 'id' | 'storeName' | 'storeSlug' | 'buyerName' | 'blocked'> & { blockedByMe: boolean }; items: HumanMessage[]; nextCursor: string | null }

const base = '/human-chat';
export const listHumanConversations = (page = 1) => unwrap(apiClient.get<ApiEnvelope<HumanConversationList>>(`${base}/conversations`, { params: { page } }));
export const openHumanConversation = (storeSlug: string, productPublicId?: string) =>
  unwrap(apiClient.post<ApiEnvelope<{ id: string }>>(`${base}/conversations`, { storeSlug, ...(productPublicId ? { productPublicId } : {}) }));
export const listHumanMessages = (id: string, cursor?: string) =>
  unwrap(apiClient.get<ApiEnvelope<HumanMessagePage>>(`${base}/conversations/${encodeURIComponent(id)}/messages`, { params: { cursor } }));
export const sendHumanMessage = (id: string, clientId: string, content: string, files: File[]) => {
  const body = new FormData();
  body.append('clientId', clientId);
  body.append('content', content);
  files.forEach((file) => body.append('images', file));
  return unwrap(apiClient.post<ApiEnvelope<HumanMessage>>(`${base}/conversations/${encodeURIComponent(id)}/messages`, body));
};
export const markHumanConversationRead = (id: string, lastSeenMessageId?: string) => unwrap(apiClient.post<ApiEnvelope<{ readAt: string | null }>>(`${base}/conversations/${encodeURIComponent(id)}/read`, { lastSeenMessageId }));
export const blockHumanConversation = (id: string, blocked: boolean) => unwrap(apiClient.put<ApiEnvelope<{ blocked: boolean }>>(`${base}/conversations/${encodeURIComponent(id)}/block`, { blocked }));
export const reportHumanConversation = (id: string, reason: string) => unwrap(apiClient.post<ApiEnvelope<{ id: string }>>(`${base}/conversations/${encodeURIComponent(id)}/reports`, { reason }));
export async function loadHumanAttachment(conversationId: string, attachmentId: string): Promise<string> {
  const response = await apiClient.get<Blob>(`${base}/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(attachmentId)}`, { responseType: 'blob' });
  return URL.createObjectURL(response.data);
}
