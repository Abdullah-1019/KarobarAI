// Feature 5 (Buyer Marketplace) — a separate controller file per the module doc's explicit
// Engineering Decision (no parallel modules/marketplace/ folder, no second repository/service —
// this file is the only new thing, sitting entirely on top of catalog.service.ts).

import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import * as catalogService from './catalog.service';

export const getHomeFeedHandler = asyncHandler(async (_req, res) => {
  const feed = await catalogService.getHomeFeed();
  res.status(200).json(ok(feed));
});

export const getCategoryBySlugHandler = asyncHandler(async (req, res) => {
  const category = await catalogService.findCategoryBySlug(req.params.slug ?? '');
  res.status(200).json(ok(category));
});
