import { useTranslation } from 'react-i18next';

// "New" chip for a list row whose order just had a notification (a new order, a return update).
// A persimmon dot plus the word, so it reads without color too.
export function NewMarker() {
  const { t } = useTranslation('common');
  return (
    <span className="new-marker">
      <span className="new-marker__dot" aria-hidden="true" />
      {t('nav.new')}
    </span>
  );
}
