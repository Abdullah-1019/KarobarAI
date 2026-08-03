import type { NotificationEventType } from '@karobarai/shared';
import type { Queue } from 'bullmq';

import { createQueue } from '../../core/queue';

// Feature 8's own gap, resolved the same way Feature 7 resolved handing a queue to a
// not-yet-built consumer: the module doc's Pre-Generation Reuse Review claims a "Notification
// module's producer/enqueue interface" was already reserved by an earlier architecture phase —
// it wasn't (this folder was, and otherwise still is, Feature 0's empty placeholder). Feature 8
// built only the minimal producer contract it needed; Feature 9 now owns the actual consumer and
// the rest of this module's shape.
//
// Feature 9 Task 2.3's inventory audit (see FEATURE_9_EVENT_INVENTORY.md) found a real
// integration mismatch here, fixed as a targeted cross-feature patch rather than silently
// accommodated: this payload originally carried a pre-rendered English-only `message` string —
// but Task 2.5/REQ-F-Notif003 require the *consumer* to render a bilingual template from
// structured variables, per the recipient's own preferred language, not a producer-baked string
// in one language. Changed to `vars`. Also renamed the poll-failure event type from this
// producer's original ad hoc `COURIER_TRACKING_FAILURE` to `TRACKING_POLL_FAILURE`, matching
// Feature 9's now-canonical event-type registry (`packages/shared`).
export interface NotificationPayload {
  userId: string; // internal users.user_id, stringified (never a publicId — this is a queue-internal payload, never sent to a client)
  type: NotificationEventType;
  orderId?: string; // the order's publicId, if this notification relates to one
  vars: Record<string, unknown>;
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
