import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import { resolveUserId } from '../../core/http/resolveUserId';
import { parseReturnId, getReturnDetail } from './returns.service';
import * as fulfillment from './return-fulfillment.service';

function id(raw: string | undefined): bigint {
  return parseReturnId(raw ?? '');
}

export const bookReturnCourierHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const returnId = id(req.params.id);
  await fulfillment.bookReturnShipment(returnId, actorId, 'RETURN', req.user!.role as 'SELLER' | 'ADMIN');
  res
    .status(200)
    .json(ok(await getReturnDetail(returnId, { userId: actorId, role: req.user!.role })));
});

export const advanceReturnShipmentHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const returnId = id(req.params.id);
  await fulfillment.advanceSimulatedReturnShipment(
    returnId,
    actorId,
    req.params.leg as 'RETURN' | 'REPLACEMENT',
  );
  res
    .status(200)
    .json(ok(await getReturnDetail(returnId, { userId: actorId, role: req.user!.role })));
});

export const confirmReturnReceiptHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const returnId = id(req.params.id);
  await fulfillment.confirmReturnReceipt(returnId, actorId, req.body.condition);
  res
    .status(200)
    .json(ok(await getReturnDetail(returnId, { userId: actorId, role: req.user!.role })));
});

export const reserveReplacementHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const returnId = id(req.params.id);
  await fulfillment.reserveReplacement(returnId, actorId, req.body.productId);
  res
    .status(200)
    .json(ok(await getReturnDetail(returnId, { userId: actorId, role: req.user!.role })));
});

export const bookReplacementHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const returnId = id(req.params.id);
  await fulfillment.bookReturnShipment(returnId, actorId, 'REPLACEMENT');
  res
    .status(200)
    .json(ok(await getReturnDetail(returnId, { userId: actorId, role: req.user!.role })));
});

export const packReplacementHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const returnId = id(req.params.id);
  await fulfillment.packReplacement(returnId, actorId);
  res.status(200).json(ok(await getReturnDetail(returnId, { userId: actorId, role: req.user!.role })));
});

export const proposeRefundHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const returnId = id(req.params.id);
  await fulfillment.proposeRefundInstead(returnId, actorId, req.body.reason);
  res
    .status(200)
    .json(ok(await getReturnDetail(returnId, { userId: actorId, role: req.user!.role })));
});

export const respondRefundHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const returnId = id(req.params.id);
  await fulfillment.respondToRefundProposal(returnId, actorId, req.body.accept);
  res
    .status(200)
    .json(ok(await getReturnDetail(returnId, { userId: actorId, role: req.user!.role })));
});

export const confirmReplacementReceiptHandler = asyncHandler(async (req, res) => {
  const actorId = await resolveUserId(req.user!.sub);
  const returnId = id(req.params.id);
  await fulfillment.confirmReplacementReceipt(returnId, actorId);
  res.status(200).json(ok(await getReturnDetail(returnId, { userId: actorId, role: req.user!.role })));
});

export const submitExchangeFeedbackHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const returnId = id(req.params.id);
  await fulfillment.submitExchangeFeedback(returnId, buyerId, req.body);
  res.status(200).json(ok(await getReturnDetail(returnId, { userId: buyerId, role: req.user!.role })));
});
