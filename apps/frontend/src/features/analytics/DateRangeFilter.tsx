import { useLayoutEffect, useRef, useState } from 'react';
import { DatePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';

import type { RangePreset } from './rangePresets';
import './DateRangeFilter.css';

const PRESETS: RangePreset[] = ['7d', '30d', '3m', 'custom'];
const PRESET_LABEL: Record<RangePreset, string> = {
  '7d': 'rangeFilter.preset7d',
  '30d': 'rangeFilter.preset30d',
  '3m': 'rangeFilter.preset3m',
  custom: 'rangeFilter.presetCustom',
};

interface DateRangeFilterProps {
  preset: RangePreset;
  customRange: [string, string] | null;
  onPresetChange: (preset: RangePreset) => void;
  onCustomRangeChange: (range: [string, string] | null) => void;
}

// SCR-S08's date-range selector (7d/30d/3m/custom, start <= end) — feeds every widget on the
// dashboard via a single shared AnalyticsRangeParams object (see AnalyticsDashboardPage). Pill
// tabs with a sliding ink, the same pattern as the orders list.
export function DateRangeFilter({ preset, customRange, onPresetChange, onCustomRangeChange }: DateRangeFilterProps) {
  const { t } = useTranslation(['analytics']);

  const pickerValue: [Dayjs, Dayjs] | null = customRange ? [dayjs(customRange[0]), dayjs(customRange[1])] : null;

  // Measured from the active tab so it fits any label length / language.
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const active = tabsRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
      if (active) setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [preset, t]);

  return (
    <div className="anRange">
      <div className="anTabs" ref={tabsRef} role="group" aria-label={t('dashboard.rangeLabel')}>
        {indicator && <span className="anTabInk" style={{ left: indicator.left, width: indicator.width }} aria-hidden="true" />}
        {PRESETS.map((key) => (
          <button key={key} type="button" className="anTab" aria-pressed={preset === key} onClick={() => onPresetChange(key)}>
            {t(PRESET_LABEL[key])}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <DatePicker.RangePicker
          className="anPicker"
          value={pickerValue}
          allowClear={false}
          disabledDate={(day) => day.isAfter(dayjs(), 'day')}
          onChange={(dates) => {
            if (!dates || !dates[0] || !dates[1]) return;
            onCustomRangeChange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
          }}
        />
      )}
    </div>
  );
}
