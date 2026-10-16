import { z } from 'zod';

import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import * as buyerChatService from './buyer-chat.service';
import type { SendBuyerMessageInput } from './buyer-chat.dto';

const storeSlugSchema = z.string().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sessionIdSchema = z.string().min(8).max(64).regex(/^[a-z0-9]+$/i);

function parseStoreSlug(value: string | undefined): string {
  return storeSlugSchema.parse(value);
}

export const getPublicStorefrontHandler = asyncHandler(async (req, res) => {
  const data = await buyerChatService.getPublicStorefront(parseStoreSlug(req.params.storeSlug));
  res.status(200).json(ok(data));
});

export const getStoreForProductHandler = asyncHandler(async (req, res) => {
  const productId = z.string().uuid().parse(req.params.productPublicId);
  const data = await buyerChatService.getStoreForLiveProduct(productId);
  res.status(200).json(ok(data));
});

export const sendBuyerMessageHandler = asyncHandler(async (req, res) => {
  const input = req.body as SendBuyerMessageInput;
  const data = await buyerChatService.sendBuyerMessage(parseStoreSlug(req.params.storeSlug), input, req.user);
  res.status(200).json(ok(data));
});

export const getBuyerConversationHandler = asyncHandler(async (req, res) => {
  const data = await buyerChatService.getBuyerConversation(
    parseStoreSlug(req.params.storeSlug),
    sessionIdSchema.parse(req.params.sessionId),
    req.user,
  );
  res.status(200).json(ok(data));
});
