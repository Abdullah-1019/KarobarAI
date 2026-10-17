import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  decreaseLabel?: string;
  increaseLabel?: string;
  /** Accessible name of the group (e.g. "Quantity"). */
  label?: string;
  /** `sm` = 36px drawn buttons with a 44px tap halo (dense cart rows). */
  size?: 'sm' | 'md';
}

// Shared qty stepper, used by Product Detail (Feature 5) and Cart (Feature 6). Studio Light: a
// stone pill track holding two round white buttons and a tabular figure between them, so it reads
// as one control instead of three boxes. The number stays typeable (numeric keyboard on phones)
// and clamps to [min, max] on blur, so a half-typed value never reaches the cart.
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled,
  decreaseLabel = 'Decrease quantity',
  increaseLabel = 'Increase quantity',
  label = 'Quantity',
  size = 'md',
}: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const clamp = (next: number) => Math.min(max ?? Infinity, Math.max(min, next));
  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    const next = Number.isNaN(parsed) ? value : clamp(parsed);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className={`qty${size === 'sm' ? ' qty--sm' : ''}`} role="group" aria-label={label}>
      <button
        type="button"
        className="qty__btn"
        aria-label={decreaseLabel}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <input
        className="qty__value"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={label}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
      <button
        type="button"
        className="qty__btn"
        aria-label={increaseLabel}
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  );
}
