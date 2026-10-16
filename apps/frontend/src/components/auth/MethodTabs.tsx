export interface MethodOption<T extends string> {
  value: T;
  label: string;
}

export interface MethodTabsProps<T extends string> {
  name: string;
  ariaLabel?: string;
  value: T;
  onChange: (value: T) => void;
  options: MethodOption<T>[];
}

// Segmented two-option switch (e.g. Mobile / Email). Native radios keep the keyboard and RTL
// behaviour identical to RoleSelector; only the visual treatment differs.
export function MethodTabs<T extends string>({
  name,
  ariaLabel,
  value,
  onChange,
  options,
}: MethodTabsProps<T>) {
  return (
    <div className="kaMethods" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label key={option.value} className="kaMethodTab" data-selected={selected}>
            <input
              className="kaSrOnly"
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
