import { Router, type NextFunction, type Request, type Response } from 'express';

import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { requireActiveSeller } from '../../core/middleware/requireActiveSeller';
import { RateLimitError } from '../../core/errors/AppError';
import { redis } from '../../core/redis';
import { validateBody } from '../../core/middleware/validate';
import { sellerConversationHandler, sellerMessageHandler } from './seller-chat.controller';
import { sellerMessageSchema } from './seller-chat.dto';

export const sellerChatRouter = Router();
sellerChatRouter.use(authenticate, authorize('SELLER'), requireActiveSeller);

function sellerChatRateLimit(req: Request, _res: Response, next: NextFunction): void {
  const key = `rate:seller-assistant:${req.sellerContext!.userId.toString()}`;
  void redis.eval(
    "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return n",
    1,
    key,
    60_000,
  ).then((count) => {
    if (Number(count) > 20) {
      next(new RateLimitError('Too many assistant requests; try again shortly', undefined, 'SELLER_CHAT_RATE_LIMIT'));
      return;
    }
    next();
  }).catch(next);
}

sellerChatRouter.post('/', sellerChatRateLimit, validateBody(sellerMessageSchema), sellerMessageHandler);
sellerChatRouter.get('/:sessionId', sellerChatRateLimit, sellerConversationHandler);
