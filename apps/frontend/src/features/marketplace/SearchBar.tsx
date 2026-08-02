import { useEffect, useState } from 'react';
import { AutoComplete, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { autocomplete } from './marketplaceApi';

// SCR-B01/B02's bilingual search bar with autocomplete. Debounced (300ms) and gated on the
// backend's own N=2-character minimum (REQ-F-Browse-002) so short input never fires a request.
export function SearchBar() {
  const { t } = useTranslation('marketplace');
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [options, setOptions] = useState<{ value: string }[]>([]);

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
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <AutoComplete
      value={value}
      options={options}
      style={{ width: '100%', maxWidth: 480 }}
      onSearch={setValue}
      onChange={setValue}
      onSelect={submit}
    >
      <Input.Search placeholder={t('home.searchPlaceholder')} onSearch={submit} allowClear />
    </AutoComplete>
  );
}
