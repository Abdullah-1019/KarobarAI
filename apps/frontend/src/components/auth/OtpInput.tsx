import { useRef } from 'react';
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  /** Fired once all boxes are filled — lets the screen auto-submit. */
  onComplete?: (value: string) => void;
  invalid?: boolean;
  /** Visual phase while/after the code is checked. */
  state?: 'verifying' | 'success';
  disabled?: boolean;
  autoFocus?: boolean;
}

// Six single-digit boxes with auto-advance, backspace-to-previous, arrow navigation, paste-anywhere
// distribution and auto-submit on completion. Always left-to-right (dir="ltr") even in Urdu.
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  invalid,
  state,
  disabled,
  autoFocus,
}: OtpInputProps) {
  const { t } = useTranslation(['auth']);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const focusAt = (index: number) => {
    const clamped = Math.max(0, Math.min(length - 1, index));
    const element = refs.current[clamped];
    element?.focus();
    element?.select();
  };

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  };

  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const typed = event.target.value.replace(/\D/g, '');
    if (!typed) return;
    const next =
      index >= value.length
        ? value + typed
        : value.slice(0, index) + typed + value.slice(index + typed.length);
    commit(next);
    focusAt(index + typed.length);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      commit(index < value.length ? value.slice(0, index) + value.slice(index + 1) : value.slice(0, -1));
      focusAt(index - 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    event.preventDefault();
    commit(pasted);
    focusAt(pasted.length);
  };

  return (
    <div className="kaOtp" data-invalid={invalid ? 'true' : undefined} data-state={state} dir="ltr">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          className="kaOtpBox"
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={value[index] ?? ''}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={t('auth:controls.otpDigit', { index: index + 1, count: length })}
          aria-invalid={invalid ? true : undefined}
        />
      ))}
    </div>
  );
}
