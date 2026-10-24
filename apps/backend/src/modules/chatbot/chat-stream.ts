import type { Request, Response } from 'express';

import { AppError } from '../../core/errors/AppError';

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
  } catch (error) {
    // Only the safe application error code is sent, never a message or stack.
    emit('error', { code: error instanceof AppError ? error.code : 'CHAT_GENERATION_FAILED' });
  } finally {
    if (!res.writableEnded) res.end();
  }
}
