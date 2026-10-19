import type { Request, Response } from 'express';

export async function streamChatResponse<T>(req: Request, res: Response, run: (
  onDelta: (text: string) => void, signal: AbortSignal,
) => Promise<T>): Promise<void> {
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const emit = (type: string, data: unknown) => {
    if (!controller.signal.aborted && !res.writableEnded) res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  try {
    const result = await run((text) => emit('delta', { text }), controller.signal);
    emit('complete', result);
  } catch {
    emit('error', { code: 'CHAT_GENERATION_FAILED' });
  } finally {
    if (!res.writableEnded) res.end();
  }
}
