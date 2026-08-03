import { createQueue } from '../../core/queue';
import type { Queue } from 'bullmq';

// Feature 8's own gap, resolved the same way Feature 7 resolved handing a queue to a
// not-yet-built consumer: the module doc's Pre-Generation Reuse Review claims a "Notification
// module's producer/enqueue interface" was already reserved by an earlier architecture phase —
// it wasn't (this folder was, and otherwise still is, Feature 0's empty placeholder). Building
// only the minimal producer contract this feature needs; Feature 9 owns the actual consumer
// (SMS/in-app/WhatsApp dispatch) and the rest of this module's shape.
export type NotificationType = 'COURIER_MANUAL_LOGISTICS' | 'COURIER_TRACKING_FAILURE' | 'ORDER_DELIVERED';

export interface NotificationPayload {
  userId: string; // publicId — the seller/buyer to notify
  type: NotificationType;
  orderId: string; // publicId
  message: string;
}

let notificationQueue: Queue | undefined;

function getNotificationQueue(): Queue {
  notificationQueue ??= createQueue('notifications-pending');
  return notificationQueue;
}

export async function enqueueNotification(payload: NotificationPayload): Promise<void> {
  await getNotificationQueue().add('notify', payload);
}

// Exposed for test teardown only, mirroring order.service.ts's closeCourierHandoffQueue() —
// lazy construction + closeability avoids the open-Redis-handle leak that fix addressed.
export async function closeNotificationQueue(): Promise<void> {
  if (notificationQueue) {
    await notificationQueue.close();
    notificationQueue = undefined;
  }
}
