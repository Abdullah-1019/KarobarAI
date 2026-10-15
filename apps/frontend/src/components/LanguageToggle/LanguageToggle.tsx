import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { Language } from '@karobarai/shared';
import { useLanguage } from '../../hooks';
import styles from './LanguageToggle.module.css';

interface LanguageOption {
  value: Language;
  label: string;
  /** BCP-47 tag so screen readers pronounce each option in its own language (WCAG 3.1.2). */
  lang: string;
}

const OPTIONS: readonly LanguageOption[] = [
  { value: 'EN', label: 'EN', lang: 'en' },
  { value: 'UR', label: 'اردو', lang: 'ur' },
];

// A short lock after a switch prevents double-toggling while i18n and AntD's direction settle.
const SWITCH_LOCK_MS = 300;

interface LanguageToggleProps {
  /** Extra class for layout/positioning owned by the parent (the pill itself is self-contained). */
  className?: string;
  /** Called after the language has been applied — for callers that need to react. */
  onChange?: (language: Language) => void;
}

/**
 * Two-option segmented pill toggle (EN / اردو) — pure CSS + React, no AntD.
 *
 * Implements the WAI-ARIA radio-group pattern (roving tabindex, arrow-key navigation that swaps
 * under RTL, Home/End) and announces the change through a polite live region. The sliding thumb
 * is a persistent element whose transform is driven by a CSS custom property, so the selected
 * state never depends on a transient node (the exact failure mode of the AntD `Segmented` this
 * replaces).
 */
export function LanguageToggle({ className, onChange }: LanguageToggleProps) {
  const { language, dir, changeLanguage } = useLanguage();
  const { t, i18n } = useTranslation('common');

  const [switching, setSwitching] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lockTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (lockTimer.current !== null) window.clearTimeout(lockTimer.current);
    },
    [],
  );

  const activeIndex = language === 'UR' ? 1 : 0;

  function select(next: Language) {
    if (switching || next === language) return;

    setSwitching(true);
    changeLanguage(next);
    onChange?.(next);

    // Announce in the newly selected language (spec §7). Resolved with a fixed translator so the
    // text is correct immediately, before i18n's change has re-rendered this subtree.
    const tNext = i18n.getFixedT(next.toLowerCase(), 'common');
    setAnnouncement(
      tNext('languageToggle.changedTo', { language: tNext(`languageToggle.${next === 'UR' ? 'ur' : 'en'}`) }),
    );

    if (lockTimer.current !== null) window.clearTimeout(lockTimer.current);
    lockTimer.current = window.setTimeout(() => setSwitching(false), SWITCH_LOCK_MS);
  }

  function moveFocus(target: number) {
    const nextIndex = (target + OPTIONS.length) % OPTIONS.length;
    const option = OPTIONS[nextIndex];
    if (!option) return;
    optionRefs.current[nextIndex]?.focus();
    select(option.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    // Arrow direction follows reading order, so Left/Right swap under RTL.
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        moveFocus(dir === 'rtl' ? index - 1 : index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        moveFocus(dir === 'rtl' ? index + 1 : index - 1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveFocus(0);
        break;
      case 'End':
        event.preventDefault();
        moveFocus(OPTIONS.length - 1);
        break;
      default:
        // Space/Enter fall through to the button's native click, which selects.
        break;
    }
  }

  const thumbTranslate = activeIndex === 0 ? '0%' : dir === 'rtl' ? '-100%' : '100%';

  return (
    <div className={[styles.toggle, className].filter(Boolean).join(' ')}>
      <div
        className={styles.rail}
        role="radiogroup"
        aria-label={t('languageToggle.label')}
        data-switching={switching ? 'true' : undefined}
      >
        <div className={styles.inner}>
          <span
            className={styles.thumb}
            style={{ '--thumb-translate': thumbTranslate } as CSSProperties}
            aria-hidden="true"
          />
          {OPTIONS.map((option, index) => {
            const checked = option.value === language;
            return (
              <button
                key={option.value}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                // Roving tabindex: only the selected radio is in the tab order.
                tabIndex={checked ? 0 : -1}
                lang={option.lang}
                className={styles.option}
                onClick={() => select(option.value)}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                <span className={option.value === 'UR' ? styles.labelUr : styles.label}>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}
