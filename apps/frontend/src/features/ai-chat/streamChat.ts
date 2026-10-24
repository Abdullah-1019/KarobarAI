import { ApiError, apiRootUrl } from '../../api';
import { useAuthStore } from '../../lib/authStore';

export class StreamRouteUnavailableError extends Error {}

export async function streamChat<T>(
  path: string,
  input: unknown,
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const response = await fetch(`${apiRootUrl}/api/v1${path}`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(input), signal,
  });
  if (response.status === 404 && response.headers.get('content-type')?.includes('text/html')) {
    throw new StreamRouteUnavailableError('Chat streaming route is unavailable');
  }
  if (!response.ok || !response.body) {
    // Errors before the stream starts (rate limit, validation) arrive as the usual API envelope.
    const envelope = await response.json().catch(() => null) as { error?: { code?: unknown; message?: unknown } } | null;
    const code = typeof envelope?.error?.code === 'string' ? envelope.error.code : 'CHAT_STREAM_UNAVAILABLE';
    throw new ApiError(code, typeof envelope?.error?.message === 'string' ? envelope.error.message : 'Chat stream unavailable');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let complete: T | undefined;
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    if (buffer.length > 128_000) throw new Error('Chat stream event too large');
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      const type = event.split('\n').find((line) => line.startsWith('event: '))?.slice(7);
      const line = event.split('\n').find((part) => part.startsWith('data: '));
      if (!type || !line) continue;
      const data: unknown = JSON.parse(line.slice(6));
      if (type === 'delta' && data && typeof data === 'object' && 'text' in data && typeof data.text === 'string') onDelta(data.text);
      if (type === 'complete') complete = data as T;
      if (type === 'error') {
        const code = data && typeof data === 'object' && 'code' in data && typeof data.code === 'string' ? data.code : 'CHAT_GENERATION_FAILED';
        throw new ApiError(code, 'Chat generation failed');
      }
    }
    if (done) break;
  }
  if (!complete) throw new Error('Chat stream ended early');
  return complete;
}
