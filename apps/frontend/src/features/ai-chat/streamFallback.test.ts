import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../api';
import { streamBuyerMessage } from '../marketplace/storeApi';
import { streamSellerAssistantMessage } from '../seller/sellerAssistantApi';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function missingRoute() {
  return new Response('<html><body>Cannot POST /chat/stream</body></html>', {
    status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

describe('AI chat compatibility with an older running API', () => {
  it('uses the existing buyer chat route when streaming is absent, without claiming deltas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(missingRoute()));
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true,
      data: { sessionId: 'buyer-session', reply: 'Hello' } } } as never);
    const onDelta = vi.fn();
    const signal = new AbortController().signal;
    const result = await streamBuyerMessage('returnai-clothing-demo', {
      message: 'hello', locale: 'en', requestId: '778536f0-3af0-4e19-9858-21e6c66128a1',
    }, onDelta, signal);
    expect(result.reply).toBe('Hello');
    expect(onDelta).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith('/stores/returnai-clothing-demo/chat',
      { message: 'hello', locale: 'en', sessionId: undefined }, { signal });
  });

  it('uses the existing seller assistant route when streaming is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(missingRoute()));
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true,
      data: { sessionId: 'seller-session', reply: 'Hello', toolCalls: 0 } } } as never);
    const result = await streamSellerAssistantMessage({ message: 'hello', locale: 'en', requestId: 'e6ec937a-527a-4bfa-a7c3-718640d691c9' },
      vi.fn(), new AbortController().signal);
    expect(result.reply).toBe('Hello');
    expect(post).toHaveBeenCalledWith('/seller/chat',
      { message: 'hello', locale: 'en', sessionId: undefined }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('does not retry a structured API 404 against another route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"success":false}', {
      status: 404, headers: { 'Content-Type': 'application/json' },
    })));
    const post = vi.spyOn(apiClient, 'post');
    await expect(streamBuyerMessage('missing-store', { message: 'hello', locale: 'en' }, vi.fn(),
      new AbortController().signal)).rejects.toThrow('Chat stream unavailable');
    expect(post).not.toHaveBeenCalled();
  });
});
