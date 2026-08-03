import type {
  BookParams,
  BookResult,
  CancelParams,
  CheckCoverageParams,
  CourierAdapter,
  CoverageResult,
  QuoteParams,
  QuoteResult,
  RateResult,
  TrackParams,
  TrackResult,
} from './index';

// Stub until real TCS/Leopards/TRAX API credentials + integration exist (Feature 16). Throwing
// here makes it obvious immediately if ADAPTER_MODE is ever flipped to "live" before this is
// actually implemented.
export class LiveCourierAdapter implements CourierAdapter {
  async getRate(): Promise<RateResult> {
    throw new Error('LiveCourierAdapter not implemented — no courier provider credentials configured yet');
  }

  async checkCoverage(_params: CheckCoverageParams): Promise<CoverageResult> {
    throw new Error('LiveCourierAdapter not implemented — no courier provider credentials configured yet');
  }

  async getQuote(_params: QuoteParams): Promise<QuoteResult> {
    throw new Error('LiveCourierAdapter not implemented — no courier provider credentials configured yet');
  }

  async book(_params: BookParams): Promise<BookResult> {
    throw new Error('LiveCourierAdapter not implemented — no courier provider credentials configured yet');
  }

  async track(_params: TrackParams): Promise<TrackResult> {
    throw new Error('LiveCourierAdapter not implemented — no courier provider credentials configured yet');
  }

  async cancel(_params: CancelParams): Promise<void> {
    throw new Error('LiveCourierAdapter not implemented — no courier provider credentials configured yet');
  }
}
