import { useEffect, useState } from 'react';
import { AutoComplete, Input, Tooltip } from 'antd';
import { Camera, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { autocomplete } from './marketplaceApi';

interface SearchBarProps {
  /** Focus the field on mount — used by the mobile search overlay. */
  autoFocus?: boolean;
  /** Cycle the placeholder through sample queries every 3s until the user engages. */
  rotatePlaceholders?: boolean;
  /** Called after a successful submit (e.g. to close the mobile overlay). */
  onSubmitted?: () => void;
  className?: string;
  /** `hero` = the Home hero's big search: a leading magnifier and a persimmon "Search" pill as
   * the page's one CTA (the sample Home design). Default = the compact header/overlay pill. */
  variant?: 'default' | 'hero';
}

const ROTATE_MS = 3000;
const SUGGESTION_KEYS = ['s1', 's2', 's3', 's4'] as const;

// Storefront search — a 48px pill with autocomplete (debounced 300ms, gated on the backend's own
// 2-character minimum, REQ-F-Browse-002), a rotating hint placeholder, and a disabled "search by
// photo" camera affordance with an explanatory tooltip (the feature isn't built yet). Submits on
// Enter or the trailing button, navigating to the text-search route.
export function SearchBar({
  autoFocus,
  rotatePlaceholders = true,
  onSubmitted,
  className,
  variant = 'default',
}: SearchBarProps) {
  const hero = variant === 'hero';
  const { t } = useTranslation('marketplace');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const urlQuery = pathname === '/search' ? (searchParams.get('q') ?? '') : '';
  const [value, setValue] = useState(urlQuery);

  // On /search the field mirrors the query being shown, so the visitor can see and refine it;
  // elsewhere it starts empty.
  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);
  const [options, setOptions] = useState<{ value: string }[]>([]);
  const [focused, setFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const suggestions = SUGGESTION_KEYS.map((key) => t(`search.suggestions.${key}`));

  useEffect(() => {
    if (!rotatePlaceholders || focused || value) return;
    const id = setInterval(
      () => setPlaceholderIndex((i) => (i + 1) % suggestions.length),
      ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [rotatePlaceholders, focused, value, suggestions.length]);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      autocomplete(query)
        .then((results) => {
          if (!cancelled) setOptions(results.map((r) => ({ value: r.title })));
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  function submit(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    onSubmitted?.();
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      role="search"
      className={className ? `storefront-search ${className}` : 'storefront-search'}
      onSubmit={(event) => {
        event.preventDefault();
        submit(value);
      }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      <AutoComplete
        value={value}
        options={options}
        style={{ width: '100%' }}
        onSearch={setValue}
        onChange={setValue}
        onSelect={submit}
      >
        <Input
          size="large"
          placeholder={suggestions[placeholderIndex]}
          autoFocus={autoFocus}
          allowClear
          prefix={hero ? <Search size={22} strokeWidth={2} aria-hidden="true" className="storefront-search__lead" /> : undefined}
          suffix={
            <span className="storefront-search__suffix">
              <Tooltip title={t('search.photo')}>
                <button
                  type="button"
                  className="storefront-search__icon"
                  disabled
                  aria-label={t('search.photo')}
                >
                  <Camera size={18} aria-hidden="true" />
                </button>
              </Tooltip>
              {hero ? (
                <button type="submit" className="btn btn--primary storefront-search__go">
                  <span className="btn__label">{t('search.submit')}</span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="storefront-search__icon"
                  aria-label={t('search.submit')}
                >
                  <Search size={18} aria-hidden="true" />
                </button>
              )}
            </span>
          }
        />
      </AutoComplete>
    </form>
  );
}
