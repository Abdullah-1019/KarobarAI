import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

// /admin/* fallback: an unknown admin URL gets a calm "not built yet" state with one way back.
export function AdminPlaceholder() {
  const { t } = useTranslation(['admin']);
  return (
    <div className="adPage">
      <section className="adMissing">
        <span className="adMissingIcon" aria-hidden="true"><Compass size={26} /></span>
        <h1 className="adMissingTitle">{t('placeholder.title')}</h1>
        <p className="adMissingBody">{t('placeholder.body')}</p>
        <Link to="/admin" className="adGhostLink">{t('placeholder.back')}</Link>
      </section>
    </div>
  );
}
