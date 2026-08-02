import { Button, InputNumber } from 'antd';

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

// Shared qty stepper — used by Product Detail (Feature 5) and Cart (Feature 6), the first
// cross-feature UI need since StatusChip/ProductStatusTag (which stayed feature-local).
// No icon package is installed in this app (antd is used without @ant-design/icons anywhere
// else), so this uses plain text glyphs rather than pulling in a new dependency for two buttons.
export function QuantityStepper({ value, min = 1, max, onChange, disabled }: QuantityStepperProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Button disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
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
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
      >
        +
      </Button>
    </div>
  );
}
