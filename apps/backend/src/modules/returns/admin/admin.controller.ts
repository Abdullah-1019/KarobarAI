import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/envelope';
import { resolveUserId } from '../../../core/http/resolveUserId';
import { parseReturnId } from '../returns.service';
import * as adminService from './admin.service';
import type { AdminDecisionInput, ListReturnsQueryInput } from '../returns.dto';

export const listAdminReturnsHandler = asyncHandler(async (req, res) => {
  const query = req.query as unknown as ListReturnsQueryInput & { history?: string };
  const result = await adminService.listAdminReturns({
    status: query.status,
    cursor: query.cursor,
    limit: query.limit,
    history: query.history === 'true',
  });
  res.status(200).json(ok(result));
});

export const getAdminReturnDetailHandler = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req.user!.sub);
  const returnId = parseReturnId(req.params.id ?? '');
  const result = await adminService.getAdminReturnDetail(returnId, { userId, role: req.user!.role });
  res.status(200).json(ok(result));
});

export const adminDecisionHandler = asyncHandler(async (req, res) => {
  const adminId = await resolveUserId(req.user!.sub);
  const returnId = parseReturnId(req.params.id ?? '');
  const input = req.body as AdminDecisionInput;
  const result = await adminService.adminDecision(adminId, returnId, input);
  res.status(200).json(ok(result));
});
