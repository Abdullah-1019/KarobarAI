import { ValidationError } from '../../core/errors/AppError';
import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import { resolveUserId } from '../../core/http/resolveUserId';
import * as returnsService from './returns.service';
import type { CreateReturnInput, ListReturnsQueryInput } from './returns.dto';

export const createReturnHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const input = req.body as CreateReturnInput;
  const result = await returnsService.createReturn(buyerId, input);
  res.status(201).json(ok(result));
});

export const listBuyerReturnsHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const query = req.query as unknown as ListReturnsQueryInput;
  const result = await returnsService.listReturnsForBuyer(buyerId, query);
  res.status(200).json(ok(result));
});

export const getReturnDetailHandler = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req.user!.sub);
  const returnId = returnsService.parseReturnId(req.params.id ?? '');
  const result = await returnsService.getReturnDetail(returnId, { userId, role: req.user!.role });
  res.status(200).json(ok(result));
});

export const uploadReturnImagesHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const returnId = returnsService.parseReturnId(req.params.id ?? '');
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    throw new ValidationError('No files uploaded (expected multipart field "images")', undefined, 'RETURN_IMAGE_INVALID_FILE');
  }
  const result = await returnsService.uploadReturnImages(
    returnId,
    buyerId,
    files.map((file) => ({ buffer: file.buffer, size: file.size })),
  );
  res.status(200).json(ok(result));
});

export const deleteReturnImageHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const returnId = returnsService.parseReturnId(req.params.id ?? '');
  const imageId = returnsService.parseReturnId(req.params.imageId ?? '');
  const result = await returnsService.deleteReturnImage(returnId, imageId, buyerId);
  res.status(200).json(ok(result));
});

export const submitReturnHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const returnId = returnsService.parseReturnId(req.params.id ?? '');
  const result = await returnsService.submitReturn(returnId, buyerId);
  res.status(200).json(ok(result));
});

export const appealReturnHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const returnId = returnsService.parseReturnId(req.params.id ?? '');
  const result = await returnsService.appealReturn(returnId, buyerId);
  res.status(200).json(ok(result));
});
