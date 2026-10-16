import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Container } from '../../components';

const DISMISS_KEY = 'karobarai:announcement-dismissed';
const ROTATE_MS = 4000;

// Buyer storefront announcement strip (36px) above the navbar. Cycles three messages every 4s and
// can be dismissed for the session (sessionStorage — reappears next session, matching a
// promo-announcement, not a permanent preference).
export function AnnouncementBar() {
  const { t } = useTranslation('marketplace');
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [index, setIndex] = useState(0);

  const messages = [t('announcement.cod'), t('announcement.returns'), t('announcement.bilingual')];

  useEffect(() => {
    if (dismissed) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % messages.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [dismissed, messages.length]);

  if (dismissed) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Private mode / storage disabled — dismiss for this render only.
    }
    setDismissed(true);
  }

  return (
    <div className="announce">
      <Container className="announce__inner">
        <p className="announce__text">{messages[index]}</p>
        <button type="button" className="announce__close" onClick={dismiss} aria-label={t('nav.dismissAnnouncement')}>
          <X size={15} aria-hidden="true" />
        </button>
      </Container>
    </div>
  );
}
