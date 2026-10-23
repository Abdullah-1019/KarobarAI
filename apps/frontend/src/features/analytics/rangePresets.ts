import type { AnalyticsRangeParams } from './analyticsApi';

export type RangePreset = '7d' | '30d' | '3m' | 'custom';

export function toRangeParams(preset: RangePreset, customRange: [string, string] | null): AnalyticsRangeParams {
  if (preset === 'custom' && customRange) {
    return { range: 'custom', startDate: customRange[0], endDate: customRange[1] };
  }
  return { range: preset === 'custom' ? '7d' : preset };
}
