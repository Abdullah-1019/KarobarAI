import { Router } from 'express';

import { authenticate } from '../../core/middleware/authenticate';
import { validateQuery } from '../../core/middleware/validate';
import { listNotificationsQuerySchema } from './notification.dto';
import { getUnreadCountHandler, listNotificationsHandler, markAsReadHandler } from './notification.controller';

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
