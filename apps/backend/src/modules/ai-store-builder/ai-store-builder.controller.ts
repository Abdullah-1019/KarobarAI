import type { AiGenerateRequestInput, AiSaveProductInput } from '@karobarai/shared';

import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import * as aiStoreBuilderService from './ai-store-builder.service';

export const uploadStagingImagesHandler = asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const result = await aiStoreBuilderService.uploadStagingImages(files);
  res.status(201).json(ok(result));
});

export const generateDraftHandler = asyncHandler(async (req, res) => {
  const input = req.body as AiGenerateRequestInput;
  const result = await aiStoreBuilderService.generateDraft(input);
  res.status(200).json(ok(result));
});

export const saveProductHandler = asyncHandler(async (req, res) => {
  const sellerUserId = req.sellerContext!.userId;
  const input = req.body as AiSaveProductInput;
  const result = await aiStoreBuilderService.saveProduct(sellerUserId, input);
  res.status(201).json(ok(result));
});
