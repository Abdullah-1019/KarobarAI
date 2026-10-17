import { useTranslation } from 'react-i18next';

import { AiMark, Button } from '../../components';

// "Sell with AI" band (Home → /sell), Studio Light: a light peach wash band (36px, a lilac blob in
// one corner) instead of a dark block — the sample Home design. Copy stays honest (rule K): the AI
// Store Builder writes the titles, description and tags in both languages; the seller checks them,
// sets the price and publishes. The listing card shows exactly that flow — AI-written fields in
// English and Urdu, the tags, and the one field the seller still fills (the price, dashed) — and is
// decorative (aria-hidden), so its "Publish" is a drawn pill, not a control.
export function AiBanner() {
  const { t } = useTranslation('marketplace');

  return (
    <section className="sell-band" aria-labelledby="sell-band-title">
      <span className="sell-band__blob" aria-hidden="true" />
      <div className="sell-band__copy">
        <h2 className="sell-band__title" id="sell-band-title">
          {t('home.aiBanner.title')}
        </h2>
        <p className="sell-band__sub">{t('home.aiBanner.subtitle')}</p>
        <div className="sell-band__ctas">
          <Button variant="cta" size="lg" to="/register?role=seller">
            {t('home.aiBanner.cta')}
          </Button>
          <Button variant="secondary" size="lg" to="/sell" arrow>
            {t('home.aiBanner.secondary')}
          </Button>
        </div>
      </div>

      <div className="sell-band__art" aria-hidden="true">
        <div className="ai-listing">
          <div className="ai-listing__head">
            <span className="ai-listing__photo">
              <img src="/demo/products/fashion-clothing.svg" alt="" width={400} height={500} />
            </span>
            <span className="ai-listing__meta">
              <span className="ai-listing__chip">
                <AiMark size={12} color="var(--ai-accent)" />
                {t('home.aiBanner.cardChip')}
              </span>
              <span className="ai-listing__file">{t('home.aiBanner.cardFile')}</span>
            </span>
          </div>
          <div className="ai-listing__field">
            <span className="ai-listing__label">{t('home.aiBanner.titleEnLabel')}</span>
            <span className="ai-listing__value" lang="en" dir="ltr">
              {t('sell.demo.titleEn')}
            </span>
          </div>
          <div className="ai-listing__field ai-listing__field--ur" dir="rtl">
            <span className="ai-listing__label" lang="ur">
              {t('home.aiBanner.titleUrLabel')}
            </span>
            <span className="ai-listing__value ai-listing__value--ur" lang="ur">
              {t('sell.demo.titleUr')}
            </span>
          </div>
          <div className="ai-listing__tags">
            <span>{t('sell.demo.tag1')}</span>
            <span>{t('sell.demo.tag2')}</span>
            <span>{t('sell.demo.tag3')}</span>
            <span lang="ur" className="ai-listing__tag-ur">
              {(t('sell.demo.pairs', { returnObjects: true }) as [string, string][])[0]?.[1]}
            </span>
          </div>
          <div className="ai-listing__foot">
            <span className="ai-listing__price">{t('home.aiBanner.pricePlaceholder')}</span>
            <span className="ai-listing__publish">{t('home.aiBanner.publish')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
