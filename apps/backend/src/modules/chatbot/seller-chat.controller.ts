import { z } from 'zod';

import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import * as sellerChat from './seller-chat.service';
import type { SellerMessageInput } from './seller-chat.dto';

const sessionIdSchema = z.string().min(8).max(64).regex(/^[a-z0-9]+$/i);

export const sellerMessageHandler = asyncHandler(async (req, res) => {
  const data = await sellerChat.sendSellerMessage(req.sellerContext!.userId, req.body as SellerMessageInput);
  res.status(200).json(ok(data));
});

export const sellerConversationHandler = asyncHandler(async (req, res) => {
  const data = await sellerChat.getSellerConversation(req.sellerContext!.userId, sessionIdSchema.parse(req.params.sessionId));
  res.status(200).json(ok(data));
});
