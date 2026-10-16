import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface RoleOption<T extends string> {
  value: T;
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface RoleSelectorProps<T extends string> {
  name: string;
  legend?: string;
  ariaLabel?: string;
  value: T;
  onChange: (value: T) => void;
  options: RoleOption<T>[];
}

// Two selectable radio cards. Native radios sharing a `name` give keyboard arrow keys and
// screen-reader grouping for free; the visible card is styled from the sibling input's state.
export function RoleSelector<T extends string>({
  name,
  legend,
  ariaLabel,
  value,
  onChange,
  options,
}: RoleSelectorProps<T>) {
  return (
    <fieldset className="kaRoleFieldset" aria-label={legend ? undefined : ariaLabel}>
      {legend && <legend className="kaFieldLabel">{legend}</legend>}
      <div className="kaRoleGroup">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = option.value === value;
          return (
            <label key={option.value} className="kaRoleCard" data-selected={selected}>
              <input
                className="kaSrOnly"
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
              />
              <span className="kaRoleIcon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <span className="kaRoleTitle">{option.title}</span>
              <span className="kaRoleDesc">{option.description}</span>
              <Check className="kaRoleCheck" size={18} aria-hidden="true" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
