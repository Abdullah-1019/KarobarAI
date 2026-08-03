import type { NotificationEventType } from '@karobarai/shared';

// Task 2.5 — templates decoupled from code (TRD §12, REQ-F-Notif003): editing wording means
// editing this file only, never notification.service.ts's dispatch logic. A single typed object
// (rather than one JSON file per event) achieves the identical practical goal with far less file
// management — an Engineering Decision, not a shortcut around the actual requirement.
interface TemplatePair {
  en: string;
  ur: string;
}

const TEMPLATES: Record<string, TemplatePair> = {
  // Task 2.6 — registered for structural completeness (the registry has an entry, so a future
  // caller can look up "what does the OTP template say" in one place). Feature 1's actual OTP
  // dispatch (auth.service.ts) remains a direct, synchronous SmsAdapter.sendSms() call — never
  // rerouted through this feature's async consumer, since OTP delivery must not wait on a queue
  // round-trip. This entry does not change Feature 1's live behavior in any way.
  OTP_REQUESTED: {
    en: 'Your KarobarAI verification code is {{code}}. It expires in {{ttlMinutes}} minutes.',
    ur: 'آپ کا KarobarAI تصدیقی کوڈ {{code}} ہے۔ یہ {{ttlMinutes}} منٹ میں ختم ہو جائے گا۔',
  },
  ORDER_PLACED: {
    en: 'Your order #{{orderId}} has been placed.',
    ur: 'آپ کا آرڈر #{{orderId}} موصول ہو گیا ہے۔',
  },
  ORDER_PAYMENT_CONFIRMED: {
    en: 'Payment confirmed for order #{{orderId}}.',
    ur: 'آرڈر #{{orderId}} کی ادائیگی کی تصدیق ہو گئی ہے۔',
  },
  ORDER_CANCELLED: {
    en: 'Order #{{orderId}} has been cancelled.',
    ur: 'آرڈر #{{orderId}} منسوخ کر دیا گیا ہے۔',
  },
  ORDER_PICKED_UP: {
    en: 'Your order #{{orderId}} has been picked up by the courier.',
    ur: 'آپ کا آرڈر #{{orderId}} کورئیر نے وصول کر لیا ہے۔',
  },
  ORDER_IN_TRANSIT: {
    en: 'Your order #{{orderId}} is in transit.',
    ur: 'آپ کا آرڈر #{{orderId}} راستے میں ہے۔',
  },
  ORDER_OUT_FOR_DELIVERY: {
    en: 'Your order #{{orderId}} is out for delivery.',
    ur: 'آپ کا آرڈر #{{orderId}} ترسیل کے لیے روانہ ہو چکا ہے۔',
  },
  ORDER_DELIVERED: {
    en: 'Your order #{{orderId}} has been delivered.',
    ur: 'آپ کا آرڈر #{{orderId}} ترسیل ہو گیا ہے۔',
  },
  COURIER_MANUAL_LOGISTICS: {
    en: 'All couriers failed to book order #{{orderId}} — manual logistics required.',
    ur: 'آرڈر #{{orderId}} کے لیے تمام کورئیر بک کرنے میں ناکام رہے — دستی انتظام درکار ہے۔',
  },
  TRACKING_POLL_FAILURE: {
    en: 'Tracking updates have failed repeatedly for order #{{orderId}}.',
    ur: 'آرڈر #{{orderId}} کے لیے ٹریکنگ اپ ڈیٹس بار بار ناکام ہو رہی ہیں۔',
  },
};

export function getTemplate(eventType: NotificationEventType): TemplatePair | undefined {
  return TEMPLATES[eventType];
}

// Exposed for Task 8.6's bilingual coverage test — every registered event type must render both
// languages, catching a missing language variant here rather than in production.
export const REGISTERED_EVENT_TYPES = Object.keys(TEMPLATES);

export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}
