import { DatePicker, Segmented } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';

import type { AnalyticsRangeParams } from './analyticsApi';

export type RangePreset = '7d' | '30d' | '3m' | 'custom';

interface DateRangeFilterProps {
  preset: RangePreset;
  customRange: [string, string] | null;
  onPresetChange: (preset: RangePreset) => void;
  onCustomRangeChange: (range: [string, string] | null) => void;
}

// SCR-S08's date-range selector (7d/30d/3m/custom, start <= end) — feeds every widget on the
// dashboard via a single shared AnalyticsRangeParams object (see AnalyticsDashboardPage).
export function DateRangeFilter({ preset, customRange, onPresetChange, onCustomRangeChange }: DateRangeFilterProps) {
  const { t } = useTranslation(['analytics']);

  const pickerValue: [Dayjs, Dayjs] | null = customRange ? [dayjs(customRange[0]), dayjs(customRange[1])] : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
      <Segmented
        value={preset}
        onChange={(value) => onPresetChange(value as RangePreset)}
        options={[
          { label: t('rangeFilter.preset7d'), value: '7d' },
          { label: t('rangeFilter.preset30d'), value: '30d' },
          { label: t('rangeFilter.preset3m'), value: '3m' },
          { label: t('rangeFilter.presetCustom'), value: 'custom' },
        ]}
      />
      {preset === 'custom' && (
        <DatePicker.RangePicker
          value={pickerValue}
          allowClear={false}
          onChange={(dates) => {
            if (!dates || !dates[0] || !dates[1]) return;
            onCustomRangeChange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
          }}
        />
      )}
    </div>
  );
}

export function toRangeParams(preset: RangePreset, customRange: [string, string] | null): AnalyticsRangeParams {
  if (preset === 'custom' && customRange) {
    return { range: 'custom', startDate: customRange[0], endDate: customRange[1] };
  }
  return { range: preset === 'custom' ? '7d' : preset };
}
