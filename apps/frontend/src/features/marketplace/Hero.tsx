import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { CategoryDTO, ProductDetailDTO } from '@karobarai/shared';
import { AiMark, PriceDisplay } from '../../components';
import { useLanguage } from '../../hooks';
import { CATEGORY_ART, tintFor } from './categoryVisuals';
import { SearchBar } from './SearchBar';

interface HeroProps {
  /** Real categories from the home feed — rendered as quick-browse chips once loaded. */
  categories?: CategoryDTO[];
  /** Real products from the home feed — they become the fanned cards once loaded. */
  products?: ProductDetailDTO[];
}

// The fan's resting pose, outer → centre → outer (DESIGN-CONSULT §7 "Hero card fan"): rotation in
// degrees and a drop in px. Rotations flip sign under RTL in CSS (--fan-dir), so the fan mirrors.
const FAN = [
  { r: -9, y: 34 },
  { r: -4.5, y: 10 },
  { r: 0, y: 0 },
  { r: 4.5, y: 10 },
  { r: 9, y: 34 },
] as const;

// Before the feed loads (or if it has fewer than five products with photos) the fan shows the
// category illustrations on their tints — decorative, with no titles or prices to mistake for offers.
const FALLBACK_ART = [
  CATEGORY_ART.electronics,
  CATEGORY_ART.beauty,
  CATEGORY_ART.fashion,
  CATEGORY_ART.home,
  CATEGORY_ART.sports,
] as const;
const FALLBACK_TINT = ['electronics', 'beauty-personal-care', 'fashion-clothing', 'home-kitchen', 'sports-outdoors'];

// Home hero (SCR-B01), Studio Light — the sample Home design: a centred Outfit headline with its
// other-language twin under it (Nastaliq beside English), one short promise, then the big white
// search box (the page's one persimmon action) with real category chips, over two slow peach and
// lilac blobs. Below it, five real products from the feed fan out like cards set down on a counter;
// the centre one carries its real title and price and the two floating tags state platform facts
// (AI-written bilingual listings, pay on delivery). The fan settling into place on load is the
// page's single authored motion moment.
export function Hero({ categories = [], products = [] }: HeroProps) {
  const { t, i18n } = useTranslation('marketplace');
  const { language } = useLanguage();
  const isUr = language === 'UR';
  const twinTitle = i18n.getFixedT(isUr ? 'en' : 'ur', 'marketplace')('hero.title');
  const chips = categories.slice(0, 4);
  const fanProducts = products
    .filter((p, i, all) => p.images[0]?.url && all.findIndex((q) => q.id === p.id) === i)
    .slice(0, 5);
  const live = fanProducts.length === 5;

  return (
    <section className="hero" aria-labelledby="hero-title">
      <span className="hero__blob hero__blob--peach" aria-hidden="true" />
      <span className="hero__blob hero__blob--lilac" aria-hidden="true" />

      <div className="hero__inner">
        <h1 className="hero__title" id="hero-title">
          {t('hero.title')}
        </h1>
        <p className="hero__twin" lang={isUr ? 'en' : 'ur'} dir={isUr ? 'ltr' : 'rtl'}>
          {twinTitle}
        </p>
        <p className="hero__sub">{t('hero.subtitle')}</p>

        <div className="hero__search" role="search" aria-label={t('hero.searchLabel')}>
          <SearchBar className="storefront-search--hero" variant="hero" />
          {chips.length > 0 && (
            <div className="hero__try">
              <span className="hero__try-label" id="hero-try-label">
                {t('hero.tryLabel')}
              </span>
              <ul className="hero__chips" aria-labelledby="hero-try-label">
                {chips.map((category) => (
                  <li key={category.id}>
                    <Link to={`/category/${category.slug}`} className="hero__chip">
                      {(isUr ? category.nameUr : category.nameEn) || category.slug}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div
          className="hero-fan"
          {...(live ? { role: 'group', 'aria-label': t('hero.featuredFrom') } : { role: 'img', 'aria-label': t('hero.showcaseLabel') })}
        >
          {FAN.map((pose, index) => {
            const style = { '--r': `${pose.r}deg`, '--y': `${pose.y}px`, '--i': index } as CSSProperties;
            const centre = index === 2;
            const product = live ? fanProducts[index] : undefined;

            if (product) {
              const title = isUr && product.titleUr ? product.titleUr : product.titleEn;
              return (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className={`hero-fan__card${centre ? ' hero-fan__card--centre' : ''}`}
                  style={style}
                  aria-label={centre ? undefined : title}
                >
                  <span className="hero-fan__art" style={{ background: tintFor(product.category?.slug ?? '') }}>
                    <img src={product.images[0]!.url} alt="" width={400} height={500} />
                  </span>
                  {centre && (
                    <>
                      <span className="hero-fan__title">{title}</span>
                      <span className="hero-fan__price">
                        <PriceDisplay amount={product.price} strong />
                      </span>
                    </>
                  )}
                  {centre && <FanTags />}
                </Link>
              );
            }

            return (
              <span
                key={index}
                className={`hero-fan__card${centre ? ' hero-fan__card--centre' : ''}`}
                style={style}
              >
                <span className="hero-fan__art" style={{ background: tintFor(FALLBACK_TINT[index] ?? '') }}>
                  <img src={FALLBACK_ART[index]} alt="" width={400} height={500} />
                </span>
                {centre && <FanTags />}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// The two floating tags pinned to the centre card: platform facts, not claims about one product.
function FanTags() {
  const { t } = useTranslation('marketplace');
  return (
    <>
      <span className="hero-tag hero-tag--ai">
        <AiMark size={14} color="var(--ai-accent)" />
        {t('hero.aiTag')}
      </span>
      <span className="hero-tag hero-tag--cod">{t('hero.codTag')}</span>
    </>
  );
}
