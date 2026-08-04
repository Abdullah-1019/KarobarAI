import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/envelope';
import { resolveUserId } from '../../../core/http/resolveUserId';
import { parseReturnId } from '../returns.service';
import * as sellerService from './seller.service';
import type { ListReturnsQueryInput, SellerDecisionInput } from '../returns.dto';

export const listSellerReturnsHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const query = req.query as unknown as ListReturnsQueryInput & { history?: string };
  const result = await sellerService.listSellerReturns(sellerId, {
    status: query.status,
    cursor: query.cursor,
    limit: query.limit,
    history: query.history === 'true',
  });
  res.status(200).json(ok(result));
});

export const getSellerReturnDetailHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const returnId = parseReturnId(req.params.id ?? '');
  const result = await sellerService.getSellerReturnDetail(sellerId, returnId);
  res.status(200).json(ok(result));
});

export const sellerDecisionHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const returnId = parseReturnId(req.params.id ?? '');
  const input = req.body as SellerDecisionInput;
  const result = await sellerService.sellerDecision(sellerId, returnId, input);
  res.status(200).json(ok(result));
});

export const sellerEscalateHandler = asyncHandler(async (req, res) => {
  const sellerId = await resolveUserId(req.user!.sub);
  const returnId = parseReturnId(req.params.id ?? '');
  await sellerService.sellerEscalate(sellerId, returnId);
  res.status(200).json(ok({ escalated: true }));
});
