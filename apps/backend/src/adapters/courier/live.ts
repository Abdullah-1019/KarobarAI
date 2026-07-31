import type { CourierAdapter, RateResult } from './index';

// Stub until real TCS/Leopards/TRAX API credentials + integration exist (Feature 7/8, per
// adapters/courier's original placeholder). Throwing here makes it obvious immediately if
// ADAPTER_MODE is ever flipped to "live" before this is actually implemented.
export class LiveCourierAdapter implements CourierAdapter {
  async getRate(): Promise<RateResult> {
    throw new Error('LiveCourierAdapter not implemented — no courier provider credentials configured yet');
  }
}
