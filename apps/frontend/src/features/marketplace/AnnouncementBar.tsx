import { useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getStoreDirectory } from './storeApi';

const DISMISS_KEY = 'karobarai:announcement-dismissed';

// Buyer storefront announcement strip (36px, ink) above the glass nav: a news ticker. The true
// platform facts travel across in one line (right to left; left to right in Urdu), pause while the
// pointer or focus is on the strip, and stand still under prefers-reduced-motion. The run is
// rendered twice so the loop is seamless; screen readers get the first copy only. The live store
// count comes from the store directory's total and is left out until it loads. Dismissible for
// the session (sessionStorage — it comes back next session, like a promo strip).
export function AnnouncementBar() {
  const { t } = useTranslation('marketplace');
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const storeTotal = useQuery({
    queryKey: ['stores', 'directory-total'],
    queryFn: () => getStoreDirectory({ limit: 1 }),
    select: (result) => result.total,
    staleTime: 10 * 60_000,
    enabled: !dismissed,
  });

  if (dismissed) return null;

  const messages = [
    t('announcement.cod'),
    t('announcement.tracking'),
    t('announcement.returns'),
    t('announcement.ai'),
    ...(storeTotal.data ? [t('announcement.stores', { count: storeTotal.data })] : []),
    t('announcement.bilingual'),
  ];

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Private mode / storage disabled — dismiss for this render only.
    }
    setDismissed(true);
  }

  const run = (copy: number) => (
    <ul className="announce__run" aria-hidden={copy > 0 || undefined}>
      {messages.map((message) => (
        <li key={message} className="announce__item">
          <span className="announce__dot" aria-hidden="true" />
          {message}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="announce" role="region" aria-label={t('announcement.label')}>
      <div className="announce__viewport">
        {/* Keyed on the list so the loop restarts cleanly when the store count arrives. */}
        <div key={messages.length} className="announce__track" style={{ '--announce-items': messages.length } as CSSProperties}>
          {run(0)}
          {run(1)}
        </div>
      </div>
      <button type="button" className="announce__close" onClick={dismiss} aria-label={t('nav.dismissAnnouncement')}>
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
