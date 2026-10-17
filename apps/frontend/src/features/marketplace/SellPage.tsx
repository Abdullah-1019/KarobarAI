import { Collapse } from 'antd';
import { BarChart3, Banknote, Camera, ClipboardCheck, RotateCcw, Rocket, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AiMark, Button } from '../../components';
import { AiListingDemo } from './AiListingDemo';

const STEPS = [
  { key: 'step1', icon: Camera },
  { key: 'step2', icon: ClipboardCheck },
  { key: 'step3', icon: Rocket },
] as const;

const FEATURES = [
  { key: 'featureCod', icon: Banknote },
  { key: 'featureCourier', icon: Truck },
  { key: 'featureReturns', icon: RotateCcw },
  { key: 'featureAnalytics', icon: BarChart3 },
] as const;

const FAQ_KEYS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5'] as const;

// /sell — the seller landing page (a Persuade surface). One story: a micro-seller learns that a
// single photo becomes a bilingual listing, sees it happen (the live AI demo is the page's
// signature moment), learns the three steps, what the platform handles after publishing, gets the
// common questions answered, and is invited once more at the close. Every claim maps to a real,
// shipped feature (AI Store Builder, COD, courier booking, photo-backed returns, analytics); no
// testimonials, seller counts or prices are invented.
export function SellPage() {
  const { t } = useTranslation('marketplace');

  return (
    <div className="sell">
      <section className="sell-hero">
        <span className="sell-hero__pattern blockprint-layer" aria-hidden="true" />
        <div className="sell-hero__inner">
          <div className="sell-hero__copy">
            <h1 className="sell-hero__title">{t('sell.title')}</h1>
            <p className="sell-hero__sub">{t('sell.subtitle')}</p>
            <div className="sell-hero__ctas">
              <Button variant="cta" size="lg" to="/register?role=seller">
                {t('sell.cta')}
              </Button>
              <Button variant="outline-light" size="lg" to="/login">
                {t('sell.login')}
              </Button>
            </div>
          </div>
          <AiListingDemo />
        </div>
      </section>

      <section className="sell-section" aria-labelledby="sell-steps-title">
        <h2 id="sell-steps-title" className="sell-section__title">
          {t('sell.stepsTitle')}
        </h2>
        <ol className="sell-steps">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <li key={key} className="sell-step">
              <span className="sell-step__marker" aria-hidden="true">
                <Icon size={22} />
                <span className="sell-step__num">{index + 1}</span>
              </span>
              <h3 className="sell-step__title">{t(`sell.${key}Title`)}</h3>
              <p className="sell-step__body">{t(`sell.${key}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="sell-section" aria-labelledby="sell-features-title">
        <h2 id="sell-features-title" className="sell-section__title">
          {t('sell.featuresTitle')}
        </h2>
        <div className="sell-features">
          <article className="sell-feature-main">
            <AiMark size={28} color="var(--accent-marigold)" />
            <h3 className="sell-feature-main__title">{t('sell.featureMainTitle')}</h3>
            <p className="sell-feature-main__body">{t('sell.featureMainBody')}</p>
            <ul className="sell-feature-main__pairs" aria-hidden="true">
              {(t('sell.demo.pairs', { returnObjects: true }) as [string, string][]).map(([en, ur]) => (
                <li key={en}>
                  <span lang="en" dir="ltr">
                    {en}
                  </span>
                  <span lang="ur" dir="rtl">
                    {ur}
                  </span>
                </li>
              ))}
            </ul>
          </article>
          <ul className="sell-feature-list">
            {FEATURES.map(({ key, icon: Icon }) => (
              <li key={key} className="sell-feature">
                <span className="sell-feature__icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <div>
                  <h3 className="sell-feature__title">{t(`sell.${key}Title`)}</h3>
                  <p className="sell-feature__body">{t(`sell.${key}Body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sell-section sell-section--narrow" aria-labelledby="sell-faq-title">
        <h2 id="sell-faq-title" className="sell-section__title">
          {t('sell.faqTitle')}
        </h2>
        <Collapse
          className="sell-faq"
          bordered={false}
          expandIconPosition="end"
          items={FAQ_KEYS.map((key) => ({
            key,
            label: t(`sell.${key}Q`),
            children: <p className="sell-faq__answer">{t(`sell.${key}A`)}</p>,
          }))}
        />
      </section>

      <section className="sell-final">
        <span className="sell-final__pattern blockprint-layer" aria-hidden="true" />
        <h2 className="sell-final__title">{t('sell.finalTitle')}</h2>
        <p className="sell-final__body">{t('sell.finalBody')}</p>
        <Button variant="cta" size="lg" to="/register?role=seller">
          {t('sell.cta')}
        </Button>
      </section>
    </div>
  );
}
