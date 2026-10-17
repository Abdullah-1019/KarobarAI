import { useTranslation } from 'react-i18next';

import { AiMark, Button } from '../../components';

// "Sell with AI" banner — an espresso band echoing the hero, marked with the brass AI mark. Copy stays honest (rule K):
// the AI Store Builder writes titles/descriptions/tags, so the banner claims exactly that and
// nothing more. The mock listing card is decorative.
export function AiBanner() {
  const { t } = useTranslation('marketplace');

  return (
    <div className="ai-banner">
      <span className="blockprint-layer ai-banner__pattern" aria-hidden="true" />
      <div className="ai-banner__copy">
        <h2 className="ai-banner__title">{t('home.aiBanner.title')}</h2>
        <p className="ai-banner__sub">{t('home.aiBanner.subtitle')}</p>
        <div className="ai-banner__ctas">
          <Button variant="cta" size="lg" to="/register?role=seller">
            {t('home.aiBanner.cta')}
          </Button>
          <Button variant="outline-light" size="lg" to="/sell">
            {t('home.aiBanner.secondary')}
          </Button>
        </div>
      </div>

      <div className="ai-banner__art" aria-hidden="true">
        <div className="ai-card">
          <img className="ai-card__photo" src="/demo/products/fashion-clothing.svg" alt="" width={400} height={500} />
          <span className="ai-card__title" lang="en" dir="ltr">
            {t('sell.demo.titleEn')}
          </span>
          <span className="ai-card__title ai-card__title--ur" lang="ur" dir="rtl">
            {t('sell.demo.titleUr')}
          </span>
          <span className="ai-banner__chip">
            <AiMark size={15} color="var(--brand-ink)" />
            {t('home.aiBanner.artChip')}
          </span>
        </div>
      </div>
    </div>
  );
}
