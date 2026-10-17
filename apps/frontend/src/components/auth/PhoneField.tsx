import { forwardRef } from 'react';
import type { ClipboardEvent, ReactNode } from 'react';

import { FieldShell } from './FieldShell';
import { fieldDescribedBy } from './fieldAria';

export interface PhoneFieldProps {
  id?: string;
  name?: string;
  label?: string;
  labelAccessory?: ReactNode;
  /** The national number only (without the +92 country code). */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
}

// Strips every non-digit, then a pasted country code (+92 / 92 / 0092) and any leading zeros —
// so pasting "+92 300 1234567" or "03001234567" both land in the field as "3001234567".
function normalizePasted(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('0092')) digits = digits.slice(4);
  else if (digits.startsWith('92')) digits = digits.slice(2);
  return digits.replace(/^0+/, '');
}

// One box: 🇵🇰 +92 badge | national number. The whole box is a single focus ring (:focus-within),
// and the digits always read left-to-right regardless of the page direction.
export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(function PhoneField(
  {
    id,
    name,
    label,
    labelAccessory,
    value,
    onChange,
    onBlur,
    error,
    hint,
    placeholder,
    autoComplete,
    disabled,
    autoFocus,
    maxLength,
  },
  ref,
) {
  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = normalizePasted(event.clipboardData.getData('text'));
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
  };

  return (
    <FieldShell id={id} label={label} labelAccessory={labelAccessory} error={error} hint={hint}>
      <div className="kaPhone" data-invalid={error ? 'true' : undefined}>
        <span className="kaPhonePrefix">
          <span className="kaPhoneFlag" aria-hidden="true">
            🇵🇰
          </span>
          <span className="kaPhoneCode" dir="ltr">
            +92
          </span>
        </span>
        <input
          ref={ref}
          id={id}
          name={name}
          className="kaPhoneInput"
          type="tel"
          inputMode="numeric"
          dir="ltr"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
          onBlur={onBlur}
          onPaste={handlePaste}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          autoFocus={autoFocus}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(id, error, hint)}
        />
      </div>
    </FieldShell>
  );
});
