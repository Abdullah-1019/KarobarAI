import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

export interface FieldShellProps {
  id?: string;
  label?: string;
  /** Inline accessory shown at the end of the label row (e.g. a "Forgot password?" link). */
  labelAccessory?: ReactNode;
  error?: string;
  hint?: string;
  children: ReactNode;
}

// Shared label / control-slot / message frame for every auth field control. Keeps the
// id → aria-describedby wiring in one place so TextField, PhoneField and PasswordField all
// announce their error and hint consistently.
export function FieldShell({ id, label, labelAccessory, error, hint, children }: FieldShellProps) {
  const errorId = id ? `${id}-error` : undefined;
  const hintId = id ? `${id}-hint` : undefined;

  return (
    <div className="kaField">
      {(label || labelAccessory) && (
        <div className="kaFieldLabelRow">
          {label && (
            <label className="kaFieldLabel" htmlFor={id}>
              {label}
            </label>
          )}
          {labelAccessory}
        </div>
      )}
      {children}
      {error ? (
        <p className="kaFieldError" id={errorId}>
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="kaFieldHint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
