import { Cpu, Shirt, Smartphone, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components';

// The Home hero (SCR-B01) — a rounded emerald banner with an ajrak-inspired pattern, the single
// page `<h1>` (the LCP element), the two primary calls to action, and a decorative product
// collage. Rendered inside the shared content column as a large rounded card rather than a
// viewport full-bleed band: the storefront content area (.karobarai-content-area) owns the page
// padding, and escaping it for a true bleed would risk a horizontal scrollbar across the ~15 other
// storefront pages that share the shell (rule M — safest choice). The collage is purely decorative
// (aria-hidden) and uses category tints + icons only, never fabricated prices/ratings (rule K).
export function Hero() {
  const { t } = useTranslation('marketplace');

  return (
    <section className="hero">
      {/* Ajrak-inspired geometric tile, faintly overlaid. */}
      <svg className="hero__ajrak" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="hero-ajrak" width="72" height="72" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#ffffff" strokeWidth="1.1">
              <path d="M36 14l5.4 11.2L53 30l-6.5 10.8L48 52l-12-5.4L24 52l1.5-11.2L19 30l11.6-4.8L36 14Z" />
              <circle cx="36" cy="33" r="3.4" />
              <path d="M0 0h9M0 0v9M72 72h-9M72 72v-9M72 0h-9M72 0v9M0 72h9M0 72v-9" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-ajrak)" />
      </svg>

      <div className="hero__inner">
        <div className="hero__copy">
          <span className="hero__badge">
            <Sparkles size={15} aria-hidden="true" />
            {t('hero.badge')}
          </span>
          <h1 className="hero__title">{t('hero.title')}</h1>
          <p className="hero__sub">{t('hero.subtitle')}</p>
          <div className="hero__ctas">
            <Button variant="cta" size="lg" to="/search">
              {t('hero.shopNow')}
            </Button>
            <Button variant="outline-light" size="lg" to="/register?role=seller">
              {t('hero.startSelling')}
            </Button>
          </div>
          <p className="hero__meta">{t('hero.meta')}</p>
        </div>

        <div className="hero__collage" aria-hidden="true">
          <div className="hero-card hero-card--fashion">
            <span className="hero-card__img">
              <Shirt size={40} />
            </span>
            <span className="hero-card__label">{t('hero.collage.fashion')}</span>
          </div>
          <div className="hero-card hero-card--mobile">
            <span className="hero-card__img">
              <Smartphone size={40} />
            </span>
            <span className="hero-card__label">{t('hero.collage.mobile')}</span>
          </div>
          <div className="hero-card hero-card--electronics">
            <span className="hero-card__img">
              <Cpu size={40} />
            </span>
            <span className="hero-card__label">{t('hero.collage.electronics')}</span>
          </div>
          <span className="hero-float">
            <Sparkles size={16} aria-hidden="true" />
            {t('hero.aiFloat')}
          </span>
        </div>
      </div>
    </section>
  );
}
