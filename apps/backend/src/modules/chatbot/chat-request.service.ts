import { randomUUID } from 'node:crypto';

import { ConflictError } from '../../core/errors/AppError';
import { redis } from '../../core/redis';

export async function withChatRequestLock<T>(requestId: string | undefined, run: () => Promise<T>): Promise<T> {
  if (!requestId) return run();
  const key = `lock:ai-chat-request:${requestId}`;
  const value = randomUUID();
  const acquired = await redis.set(key, value, 'EX', 2700, 'NX');
  if (acquired !== 'OK') throw new ConflictError('This chat request is already being processed');
  try { return await run(); }
  finally {
    await redis.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0", 1, key, value);
  }
}
