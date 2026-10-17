import { Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { CategoryDTO } from '@karobarai/shared';
import { AiMark } from '../../components';
import { useLanguage } from '../../hooks';
import { SearchBar } from './SearchBar';

interface HeroProps {
  /** Real categories from the home feed — rendered as quick-browse chips once loaded. */
  categories?: CategoryDTO[];
}

// The three illustrated products fanned out on the "market stall" side of the hero. Purely
// decorative: the same hand-authored placeholder art the dev seed uses, with no prices, ratings
// or seller names (nothing a visitor could mistake for a real offer).
const SHOWCASE = [
  { key: 'fashion', src: '/demo/products/fashion-clothing.svg' },
  { key: 'home', src: '/demo/products/home-kitchen.svg' },
  { key: 'sports', src: '/demo/products/sports-outdoors.svg' },
] as const;

// Home hero (SCR-B01), search-led: on a marketplace the search box *is* the primary action, so it
// sits where a CTA button would, at full width under the headline (the header's own search hides
// on Home until the visitor scrolls past this). Real categories follow as quick chips; selling is a
// quiet secondary link to /sell. The right side is a fanned stall of three illustrated products,
// with the brass AI mark on the one whose "listing" the AI wrote — the product's mechanism, shown
// rather than claimed. The fan settles once on load (the page's single authored motion moment).
export function Hero({ categories = [] }: HeroProps) {
  const { t } = useTranslation('marketplace');
  const { language } = useLanguage();
  const chips = categories.slice(0, 5);

  return (
    <section className="hero">
      <span className="hero__pattern blockprint-layer" aria-hidden="true" />

      <div className="hero__inner">
        <div className="hero__copy">
          <h1 className="hero__title">{t('hero.title')}</h1>
          <p className="hero__sub">{t('hero.subtitle')}</p>

          <div className="hero__search" role="search" aria-label={t('hero.searchLabel')}>
            <SearchBar className="storefront-search--hero" />
          </div>

          {chips.length > 0 && (
            <div className="hero__try">
              <span className="hero__try-label" id="hero-try-label">
                {t('hero.tryLabel')}
              </span>
              <ul className="hero__chips" aria-labelledby="hero-try-label">
                {chips.map((category) => (
                  <li key={category.id}>
                    <Link to={`/category/${category.slug}`} className="hero__chip">
                      {(language === 'UR' ? category.nameUr : category.nameEn) || category.slug}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link to="/sell" className="hero__sell-link">
            <Store size={18} aria-hidden="true" />
            {t('hero.sellLink')}
          </Link>
        </div>

        <div className="hero__showcase" role="img" aria-label={t('hero.showcaseLabel')}>
          {SHOWCASE.map(({ key, src }, index) => (
            <figure key={key} className={`stall-card stall-card--${index + 1}`}>
              <img src={src} alt="" className="stall-card__img" width={400} height={500} />
              <figcaption className="stall-card__caption">{t(`categoryNames.${key}`)}</figcaption>
            </figure>
          ))}
          <span className="stall-tag stall-tag--ai">
            <AiMark size={15} color="var(--brand-ink)" />
            {t('hero.aiTag')}
          </span>
          <span className="stall-tag stall-tag--cod">{t('hero.codTag')}</span>
        </div>
      </div>
    </section>
  );
}
