import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import type { ChatMessage, Conversation, StructuredNote } from '../types/chat';

export function createConversation() {
  return apiPost<{ conversationId: string }>('/chat/conversations', {});
}

export function listConversations() {
  return apiGet<Conversation[]>('/chat/conversations');
}

export function getMessages(conversationId: string, signal?: AbortSignal) {
  return apiGet<ChatMessage[]>(
    `/chat/conversations/${conversationId}/messages`,
    signal,
  );
}

export function rateMessage(messageId: string, rating: 1 | -1) {
  return apiPost<{ ok: true }>(`/chat/messages/${messageId}/rating`, {
    rating,
  });
}

export function generateStructuredNote(text: string) {
  return apiPost<StructuredNote>('/chat/structured', { text });
}

export const renameConversation = (id: string, title: string) =>
  apiPatch<{ ok: true }>('/chat/conversations/' + id, { title });
export const deleteConversation = (id: string) =>
  apiDelete<{ ok: true }>('/chat/conversations/' + id);
