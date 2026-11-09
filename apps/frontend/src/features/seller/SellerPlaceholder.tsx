import { Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

// /seller/* fallback (e.g. Wallet, not built yet): a calm "coming soon" with one way back home.
export function SellerPlaceholder() {
  const { t } = useTranslation(['common']);
  return (
    <div className="slEmpty">
      <span className="slEmptyIcon" aria-hidden="true">
        <Hourglass size={22} />
      </span>
      <h1 className="slEmptyTitle">{t('placeholder.soonTitle')}</h1>
      <p className="slEmptyBody">{t('placeholder.soonBody')}</p>
      <Link to="/seller" className="slTextLink">
        {t('placeholder.backHome')}
      </Link>
    </div>
  );
}
