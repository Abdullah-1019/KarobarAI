import { Button, InputNumber } from 'antd';
import { Minus, Plus } from 'lucide-react';

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  decreaseLabel?: string;
  increaseLabel?: string;
}

// Shared qty stepper — used by Product Detail (Feature 5) and Cart (Feature 6). Lucide icons
// (UIUX §7) replaced the plain −/+ text glyphs now that lucide-react is installed; label props
// are optional with English defaults so existing call sites keep working unchanged while callers
// can pass translated strings later.
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled,
  decreaseLabel = 'Decrease quantity',
  increaseLabel = 'Increase quantity',
}: QuantityStepperProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
      <Button aria-label={decreaseLabel} disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={16} aria-hidden="true" />
      </Button>
      <InputNumber
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(next) => {
          if (typeof next === 'number') onChange(Math.min(max ?? Infinity, Math.max(min, next)));
        }}
        style={{ width: 64, textAlign: 'center' }}
      />
      <Button
        aria-label={increaseLabel}
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
      >
        <Plus size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}
