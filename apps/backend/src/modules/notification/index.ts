// Notification module (BullMQ producers/consumers + Notification Center). Feature 8 added the
// minimal producer contract (notification.producer.ts) before this module's real consumer/
// dispatch logic existed — Feature 9 built the rest of this module's shape.
export { enqueueNotification, closeNotificationQueue } from './notification.producer';
export type { NotificationPayload } from './notification.producer';
export { startNotificationConsumer } from './notification.consumer';
export { notificationRouter } from './notification.routes';
export { processNotificationEvent } from './notification.service';
