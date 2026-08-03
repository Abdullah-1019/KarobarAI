import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import { resolveUserId } from '../../core/http/resolveUserId';
import * as notificationService from './notification.service';
import type { ListNotificationsQueryInput } from './notification.dto';

// Task 4 — Notification Center. Ownership always self (Task 1.4) — no ?userId param exists or is
// accepted anywhere here.

export const listNotificationsHandler = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req.user!.sub);
  const query = req.query as unknown as ListNotificationsQueryInput;
  const result = await notificationService.listNotificationsForUser(userId, query);
  res.status(200).json(ok(result));
});

export const getUnreadCountHandler = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req.user!.sub);
  const result = await notificationService.getUnreadCountForUser(userId);
  res.status(200).json(ok(result));
});

export const markAsReadHandler = asyncHandler(async (req, res) => {
  const userId = await resolveUserId(req.user!.sub);
  const notificationId = notificationService.parseNotificationId(req.params.id ?? '');
  await notificationService.markNotificationRead(notificationId, userId);
  res.status(200).json(ok({ read: true }));
});
