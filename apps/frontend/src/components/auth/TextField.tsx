import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { FieldShell } from './FieldShell';
import { fieldDescribedBy } from './fieldAria';

export interface TextFieldProps {
  id?: string;
  name?: string;
  label?: string;
  labelAccessory?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  type?: InputHTMLAttributes<HTMLInputElement>['type'];
  autoComplete?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  dir?: 'ltr' | 'rtl';
  icon?: LucideIcon;
  trailing?: ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
}

// Standard single-line auth input: 48px tall, leading icon optional, and error/hint messaging via
// FieldShell. Controlled with a plain string value so it drops straight into react-hook-form's
// Controller (`value={field.value} onChange={field.onChange}`).
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
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
    type = 'text',
    autoComplete,
    inputMode,
    dir,
    icon: Icon,
    trailing,
    disabled,
    autoFocus,
    maxLength,
  },
  ref,
) {
  return (
    <FieldShell id={id} label={label} labelAccessory={labelAccessory} error={error} hint={hint}>
      <div
        className={`kaControl${Icon ? ' kaControl--icon' : ''}${trailing ? ' kaControl--trailing' : ''}`}
        data-invalid={error ? 'true' : undefined}
      >
        {Icon && <Icon className="kaControlIcon" size={18} aria-hidden="true" />}
        <input
          ref={ref}
          id={id}
          name={name}
          className="kaInput"
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          dir={dir}
          maxLength={maxLength}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(id, error, hint)}
        />
        {trailing && <span className="kaControlTrailing">{trailing}</span>}
      </div>
    </FieldShell>
  );
});
