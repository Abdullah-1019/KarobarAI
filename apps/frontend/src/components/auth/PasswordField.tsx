import { forwardRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FieldShell } from './FieldShell';
import { fieldDescribedBy } from './fieldAria';
import { PasswordChecklist, PasswordStrength } from './PasswordStrength';

export interface PasswordFieldProps {
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
  autoComplete?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  /** Show the 4-segment strength meter (Register / Reset; never on Login). */
  showStrength?: boolean;
  /** Show the four-rule checklist while the field is focused. */
  showChecklist?: boolean;
}

// Password input: lock leading icon, an eye reveal toggle at the end, and optional strength meter +
// rule checklist (both always laid out, so nothing shifts while typing). The eye is a real button with an aria-label and aria-pressed, and the input stays
// `type="password"` until revealed.
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
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
    showStrength = false,
    showChecklist = false,
  },
  ref,
) {
  const { t } = useTranslation(['auth']);
  const [revealed, setRevealed] = useState(false);

  return (
    <FieldShell id={id} label={label} labelAccessory={labelAccessory} error={error} hint={hint}>
      <div className="kaControl kaControl--icon kaControl--trailing" data-invalid={error ? 'true' : undefined}>
        <Lock className="kaControlIcon" size={18} aria-hidden="true" />
        <input
          ref={ref}
          id={id}
          name={name}
          className="kaInput"
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(id, error, hint)}
        />
        <span className="kaControlTrailing">
          <button
            type="button"
            className="kaPwToggle"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? t('auth:controls.hidePassword') : t('auth:controls.showPassword')}
            aria-pressed={revealed}
            tabIndex={disabled ? -1 : 0}
          >
            {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </div>
      {showStrength ? <PasswordStrength password={value} /> : null}
      {showChecklist ? <PasswordChecklist password={value} /> : null}
    </FieldShell>
  );
});
