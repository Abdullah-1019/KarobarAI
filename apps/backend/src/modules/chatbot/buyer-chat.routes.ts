import { Router, type NextFunction, type Request, type Response } from 'express';

import { RateLimitError } from '../../core/errors/AppError';
import { redis } from '../../core/redis';
import { optionalAuthenticate } from '../../core/middleware/optionalAuthenticate';
import { validateBody } from '../../core/middleware/validate';
import {
  getBuyerConversationHandler,
  getPublicStorefrontHandler,
  getStoreForProductHandler,
  sendBuyerMessageHandler,
  streamBuyerMessageHandler,
} from './buyer-chat.controller';
import { sendBuyerMessageSchema } from './buyer-chat.dto';

const CHAT_WINDOW_MS = 60_000;
const CHAT_MAX_REQUESTS = 20;

function buyerChatRateLimit(req: Request, _res: Response, next: NextFunction): void {
  const storeSlug = typeof req.params.storeSlug === 'string' ? req.params.storeSlug : 'unknown';
  const ip = typeof req.ip === 'string' ? req.ip : 'unknown';
  const key = `rate:buyer-store-chat:${storeSlug}:${ip}`;
  void redis.eval(
    "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return n",
    1,
    key,
    CHAT_WINDOW_MS,
  ).then((count) => {
    if (Number(count) > CHAT_MAX_REQUESTS) {
      next(new RateLimitError('Too many store chat requests; try again shortly', undefined, 'BUYER_CHAT_RATE_LIMIT'));
      return;
    }
    next();
  }).catch(next);
}

export const buyerChatRouter = Router();
buyerChatRouter.get('/by-product/:productPublicId', getStoreForProductHandler);
buyerChatRouter.get('/:storeSlug', getPublicStorefrontHandler);
buyerChatRouter.post('/:storeSlug/chat', optionalAuthenticate, buyerChatRateLimit, validateBody(sendBuyerMessageSchema), sendBuyerMessageHandler);
buyerChatRouter.post('/:storeSlug/chat/stream', optionalAuthenticate, buyerChatRateLimit, validateBody(sendBuyerMessageSchema), streamBuyerMessageHandler);
buyerChatRouter.get('/:storeSlug/chat/:sessionId', optionalAuthenticate, buyerChatRateLimit, getBuyerConversationHandler);
