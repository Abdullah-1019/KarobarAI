import { Router } from 'express';

import { authenticate } from '../../core/middleware/authenticate';
import { validateBody, validateQuery } from '../../core/middleware/validate';
import { listNotificationsQuerySchema, markNotificationsReadSchema } from './notification.dto';
import {
  getUnreadCountHandler,
  getUnreadSummaryHandler,
  listNotificationsHandler,
  markAsReadHandler,
  markManyAsReadHandler,
} from './notification.controller';

// Task 1.4 — always personal/ownership-scoped, no guest access.
export const notificationRouter = Router();
notificationRouter.use(authenticate);

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: The authenticated user's own in-app notifications, chronological, cursor-paginated
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "NotificationListDTO: { items: NotificationDTO[], nextCursor: string | null }"
 */
notificationRouter.get('/', validateQuery(listNotificationsQuerySchema), listNotificationsHandler);

/**
 * @swagger
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Unread in-app notification count, for the bell-icon badge
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "UnreadCountDTO: { count: number }"
 */
notificationRouter.get('/unread-count', getUnreadCountHandler);

/**
 * @swagger
 * /api/v1/notifications/unread-summary:
 *   get:
 *     summary: Unread counts for the bell plus the Orders / Returns nav sections
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "UnreadSummaryDTO: { count, orders: { count, orderIds }, returns: { count, orderIds } }"
 */
notificationRouter.get('/unread-summary', getUnreadSummaryHandler);

/**
 * @swagger
 * /api/v1/notifications/read:
 *   patch:
 *     summary: Mark the user's unread notifications read — all, one section's, and/or one order's
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category: { type: string, enum: [orders, returns] }
 *               orderId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: "{ updated: number }"
 */
notificationRouter.patch('/read', validateBody(markNotificationsReadSchema), markManyAsReadHandler);

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     summary: Mark one notification as read (ownership-checked)
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: "{ read: true }"
 *       403:
 *         description: Notification belongs to another user (NOTIFICATION_NOT_OWNED)
 *       404:
 *         description: Notification not found (NOTIFICATION_NOT_FOUND)
 */
notificationRouter.patch('/:id/read', markAsReadHandler);
