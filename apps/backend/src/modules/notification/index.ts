// Notification module (BullMQ producers/consumers) — the real module (repository/service/
// controller/routes, SMS/in-app/WhatsApp dispatch) is Feature 9's scope. Feature 8 adds only the
// minimal producer contract it needs (notification.producer.ts) — same "build the contract now,
// no consumer yet" pattern Feature 7 used for the courier-assignment-pending queue.
export { enqueueNotification, closeNotificationQueue } from './notification.producer';
export type { NotificationPayload, NotificationType } from './notification.producer';
