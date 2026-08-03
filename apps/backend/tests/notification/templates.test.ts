import { CRITICAL_EVENT_TYPES } from '@karobarai/shared';

import { getTemplate, REGISTERED_EVENT_TYPES, renderTemplate } from '../../src/modules/notification/templates';

describe('Notification template registry (Task 2.5/8.6 — bilingual coverage)', () => {
  it('every registered event type has non-empty EN and UR templates', () => {
    expect(REGISTERED_EVENT_TYPES.length).toBeGreaterThan(0);
    for (const eventType of REGISTERED_EVENT_TYPES) {
      const template = getTemplate(eventType);
      expect(template?.en).toBeTruthy();
      expect(template?.ur).toBeTruthy();
    }
  });

  it('critical events (that have a real producer) are all registered in the template registry', () => {
    const dispatchedCriticalEvents = CRITICAL_EVENT_TYPES.filter(
      (t) => t !== 'RETURN_DECISION' && t !== 'REFUND_ISSUED', // Feature 10 not built yet — reserved, not dispatched
    );
    for (const eventType of dispatchedCriticalEvents) {
      expect(getTemplate(eventType)).toBeDefined();
    }
  });

  it('renderTemplate interpolates known vars and leaves unknown placeholders untouched rather than throwing', () => {
    expect(renderTemplate('Order #{{orderId}} for {{name}}', { orderId: 'ABC' })).toBe('Order #ABC for {{name}}');
  });

  it('an unregistered event type returns undefined, not a crash', () => {
    expect(getTemplate('SOME_FUTURE_EVENT_TYPE')).toBeUndefined();
  });
});
