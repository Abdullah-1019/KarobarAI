import { useEffect, useRef } from 'react';
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
  /** Real products from the home feed — they ride the curved ticker once loaded. */
  products?: ProductDetailDTO[];
}

// Before the feed loads (or if it has fewer than three products with photos) the ticker shows the
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
// lilac blobs. Below it, real products from the feed glide along a curved ticker with their titles
// and prices, and two floating tags state platform facts (AI-written bilingual listings, pay on
// delivery). The ticker is the page's single authored motion moment.
export function Hero({ categories = [], products = [] }: HeroProps) {
  const { t, i18n } = useTranslation('marketplace');
  const { language } = useLanguage();
  const isUr = language === 'UR';
  const twinTitle = i18n.getFixedT(isUr ? 'en' : 'ur', 'marketplace')('hero.title');
  const chips = categories.slice(0, 4);
  const tickerProducts = products
    .filter((p, i, all) => p.images[0]?.url && all.findIndex((q) => q.id === p.id) === i)
    .slice(0, 12);
  const live = tickerProducts.length >= 3;

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

        <HeroTicker live={live} products={tickerProducts} isUr={isUr} label={live ? t('hero.featuredFrom') : t('hero.showcaseLabel')} />
      </div>
    </section>
  );
}

// The two floating tags pinned to the middle of the ticker: platform facts, not claims about one product.
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

// Fixed card pitch and loop size: the strip is repeated until it is longer than any screen, so the
// ticker never shows a gap while it wraps around.
const MIN_LOOP_CARDS = 12;
const SPEED_PX_PER_S = 38;

interface TickerProps {
  live: boolean;
  products: ProductDetailDTO[];
  isUr: boolean;
  label: string;
}

// Products glide right-to-left along a shallow arch, like a news ticker on a curve. Every card has a
// fixed size and its photo is cropped to fill a fixed square, so no image can stretch its card. Each
// frame, a card's height on the arch and its tilt follow the curve's slope at its x position. Motion
// pauses on hover/focus and is off under prefers-reduced-motion.
function HeroTicker({ live, products, isUr, label }: TickerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const base = live ? products.length : FALLBACK_ART.length;
  const copies = Math.max(1, Math.ceil(MIN_LOOP_CARDS / base));
  const count = base * copies;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const cards = Array.from(track.children) as HTMLElement[];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let offset = 0;
    let last = performance.now();
    let paused = false;
    let frame = 0;

    const place = () => {
      const width = track.clientWidth;
      const card = cards[0]?.offsetWidth ?? 200;
      const pitch = card + (width < 768 ? 16 : 26);
      const loop = pitch * cards.length;
      const half = width / 2;
      const depth = width < 768 ? 34 : 64; // how far the ends of the arch drop, px
      const dir = getComputedStyle(track).direction === 'rtl' ? -1 : 1;
      cards.forEach((el, i) => {
        const x = ((((i * pitch - offset) % loop) + loop) % loop) - pitch;
        const d = (x + card / 2 - half) / half; // -1 at the left edge, 1 at the right edge
        const y = depth * d * d;
        const tilt = (Math.atan((2 * depth * d) / half) * 180) / Math.PI;
        const scale = 1 - Math.min(Math.abs(d), 1.2) * 0.07;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${tilt * dir}deg) scale(${scale})`;
        el.style.zIndex = String(100 - Math.round(Math.abs(d) * 50));
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      if (!paused) offset += (SPEED_PX_PER_S * dt) / 1000;
      place();
      frame = requestAnimationFrame(tick);
    };

    const pause = () => { paused = true; };
    const resume = () => { paused = false; };
    track.addEventListener('pointerenter', pause);
    track.addEventListener('pointerleave', resume);
    track.addEventListener('focusin', pause);
    track.addEventListener('focusout', resume);
    window.addEventListener('resize', place);

    place();
    if (!reduce) frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener('pointerenter', pause);
      track.removeEventListener('pointerleave', resume);
      track.removeEventListener('focusin', pause);
      track.removeEventListener('focusout', resume);
      window.removeEventListener('resize', place);
    };
  }, [count, live]);

  return (
    <div className="hero-ticker" {...(live ? { role: 'group', 'aria-label': label } : { role: 'img', 'aria-label': label })}>
      <FanTags />
      <div className="hero-ticker__track" ref={trackRef}>
        {Array.from({ length: count }, (_, index) => {
          const copy = index >= base; // repeats exist only to fill the loop; hide them from AT
          const slot = index % base;
          const product = live ? products[slot] : undefined;
          if (product) {
            const title = isUr && product.titleUr ? product.titleUr : product.titleEn;
            return (
              <Link
                key={index}
                to={`/product/${product.id}`}
                className="hero-ticker__card"
                aria-hidden={copy || undefined}
                tabIndex={copy ? -1 : undefined}
              >
                <span className="hero-ticker__art" style={{ background: tintFor(product.category?.slug ?? '') }}>
                  <img src={product.images[0]!.url} alt="" width={400} height={400} loading="lazy" draggable={false} />
                </span>
                <span className="hero-ticker__title">{title}</span>
                <span className="hero-ticker__price">
                  <PriceDisplay amount={product.price} strong />
                </span>
              </Link>
            );
          }
          return (
            <span key={index} className="hero-ticker__card hero-ticker__card--art" aria-hidden="true">
              <span className="hero-ticker__art" style={{ background: tintFor(FALLBACK_TINT[slot] ?? '') }}>
                <img src={FALLBACK_ART[slot]} alt="" width={400} height={400} draggable={false} />
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
