import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  error?: string;
}

// Native checkbox with a custom 18px box. The input stays in the DOM (visually hidden) so keyboard
// focus, Space toggling and label-click activation all keep working.
export function Checkbox({ id, checked, onChange, children, error }: CheckboxProps) {
  const errorId = id ? `${id}-error` : undefined;

  return (
    <div className="kaCheckboxField">
      <label className="kaCheckbox" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          className="kaSrOnly"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <span className="kaCheckboxBox" aria-hidden="true">
          <Check size={13} />
        </span>
        <span className="kaCheckboxLabel">{children}</span>
      </label>
      {error ? (
        <p className="kaFieldError" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
