import { afterEach, describe, expect, it, vi } from 'vitest';

import { streamChat } from './streamChat';

function response(chunks: string[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) { chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk))); controller.close(); },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('AI streaming client', () => {
  it('delivers provider chunks before the final persisted result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([
      'event: delta\ndata: {"text":"Hel',
      'lo"}\n\nevent: delta\ndata: {"text":"!"}\n\n',
      'event: complete\ndata: {"sessionId":"session","reply":"Hello!"}\n\n',
    ]));
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];
    const result = await streamChat<{ sessionId: string; reply: string }>('/seller/chat/stream', { message: 'Hi' },
      (text) => deltas.push(text), new AbortController().signal);
    expect(deltas).toEqual(['Hello', '!']);
    expect(result).toEqual({ sessionId: 'session', reply: 'Hello!' });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/seller/chat/stream'), expect.objectContaining({ method: 'POST' }));
  });

  it('rejects a stream without completion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(['event: delta\ndata: {"text":"partial"}\n\n'])));
    await expect(streamChat('/seller/chat/stream', {}, vi.fn(), new AbortController().signal)).rejects.toThrow('ended early');
  });
});
