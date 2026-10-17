import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Container } from '../../components';
import { StorefrontLogo } from './StorefrontLogo';
import { WhatsAppButton } from './WhatsAppButton';
import { getWhatsAppUrl } from './whatsapp';

// Storefront site footer (rendered by StorefrontLayout for every buyer-facing page). Only real
// destinations are linked — the app has no Terms/Privacy routes, so none are faked here. The Help
// column and the floating WhatsApp button appear only when a support number is configured.
export function StorefrontFooter() {
  const { t } = useTranslation(['marketplace', 'common']);
  const year = new Date().getFullYear();
  const whatsappUrl = getWhatsAppUrl();

  return (
    <footer className="site-footer">
      <Container className="site-footer__inner">
        <div className="site-footer__brand">
          <StorefrontLogo />
          <p className="site-footer__tagline">{t('footer.tagline')}</p>
        </div>

        <nav className="site-footer__cols" aria-label={t('footer.navLabel')}>
          <div className="site-footer__col">
            <h3 className="site-footer__col-title">{t('footer.shopTitle')}</h3>
            <ul className="site-footer__list">
              <li>
                <Link to="/">{t('footer.shopHome')}</Link>
              </li>
              <li>
                <Link to="/search">{t('footer.shopSearch')}</Link>
              </li>
              <li>
                <Link to="/cart">{t('footer.shopCart')}</Link>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h3 className="site-footer__col-title">{t('footer.sellTitle')}</h3>
            <ul className="site-footer__list">
              <li>
                <Link to="/sell">{t('footer.sellBecomeSeller')}</Link>
              </li>
              <li>
                <Link to="/login">{t('footer.sellLogin')}</Link>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h3 className="site-footer__col-title">{t('footer.accountTitle')}</h3>
            <ul className="site-footer__list">
              <li>
                <Link to="/orders">{t('common:nav.orders')}</Link>
              </li>
              <li>
                <Link to="/returns">{t('common:nav.myReturns')}</Link>
              </li>
              <li>
                <Link to="/buyer/profile">{t('common:nav.profile')}</Link>
              </li>
            </ul>
          </div>

          {whatsappUrl && (
            <div className="site-footer__col">
              <h3 className="site-footer__col-title">{t('footer.helpTitle')}</h3>
              <ul className="site-footer__list">
                <li>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    {t('whatsapp.label')}
                  </a>
                </li>
              </ul>
            </div>
          )}
        </nav>
      </Container>

      <div className="site-footer__bar">
        <Container className="site-footer__bar-inner">
          <span>© {year} KarobarAI</span>
          <span className="site-footer__note">{t('footer.note')}</span>
        </Container>
      </div>

      <WhatsAppButton />
    </footer>
  );
}
