import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Pause, Play, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AiMark, Button, PriceDisplay } from '../../components';
import { useLanguage, useMediaQuery } from '../../hooks';
import type { StoryProduct, WallPhoto } from './homePhotos';
import './heroShowcase.css';

interface HeroProps {
  photos: WallPhoto[];
  story: StoryProduct | null;
}

// Home hero (SCR-B01): a night stage in both themes. Rows of product photos drift across the whole
// screen in opposite directions; a veil, deep behind the copy and opening toward the sides, keeps
// the text clear and the products in colour. On scroll the stage holds still while the story's
// product comes forward out of the wall (useHomeStory drives that and the brand circles). The glass
// navbar sits over the stage and turns light-on-dark only while it is over it (useHeaderOverHero).
export function Hero({ photos, story }: HeroProps) {
  const { t, i18n } = useTranslation('marketplace');
  const { language } = useLanguage();
  const isUr = language === 'UR';
  const twinTitle = i18n.getFixedT(isUr ? 'en' : 'ur', 'marketplace')('hero.title');
  const heroRef = useRef<HTMLElement>(null);
  const [userPaused, setUserPaused] = useState(false);
  useHeaderOverHero(heroRef);

  return (
    <section className="hero hero--night" aria-labelledby="hero-title" ref={heroRef}>
      <PhotoWall heroRef={heroRef} photos={photos} paused={userPaused} isUr={isUr} />
      <span className="hero-veil" aria-hidden="true" />
      <span className="hero__blob hero__blob--peach" data-glow="0" aria-hidden="true" />
      <span className="hero__blob hero__blob--lilac" data-glow="1" aria-hidden="true" />
      <span className="hero-dim" aria-hidden="true" />

      <div className="hero__inner">
        <p className="hero__badge">
          <span className="hero__badge-mark" aria-hidden="true">
            <AiMark size={14} color="var(--ai-accent)" />
          </span>
          {t('hero.badge')}
        </p>
        <h1 className="hero__title" id="hero-title">
          {t('hero.title')}
        </h1>
        <p className="hero__twin" lang={isUr ? 'en' : 'ur'} dir={isUr ? 'ltr' : 'rtl'}>
          {twinTitle}
        </p>
        <p className="hero__sub">{t('hero.promise')}</p>
        <div className="hero__actions">
          <Button variant="cta" to="/search" arrow>
            {t('hero.shopNow')}
          </Button>
          <Button variant="secondary" to="/stores" icon={<Store size={16} aria-hidden="true" />}>
            {t('hero.discoverStores')}
          </Button>
        </div>
      </div>

      {story && (
        <p className="hero-found" aria-hidden="true">
          <b>{t('story.found')}</b>
          <span dir="auto">
            {(isUr && story.titleUr) || story.titleEn}, <PriceDisplay amount={story.price} />
          </span>
        </p>
      )}

      {/* Moving content that runs longer than five seconds needs a way to stop it. */}
      <button
        type="button"
        className="nw-toggle"
        aria-pressed={userPaused}
        aria-label={userPaused ? t('hero.showcase.play') : t('hero.showcase.pause')}
        title={userPaused ? t('hero.showcase.play') : t('hero.showcase.pause')}
        onClick={() => setUserPaused((value) => !value)}
      >
        {userPaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
      </button>
    </section>
  );
}

/** While the shared navbar is over the night stage it switches to its light-on-dark tokens (global.css,
 *  `.storefront-header[data-over-hero]`); past the stage, and on every other page, it is untouched. */
function useHeaderOverHero(heroRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const hero = heroRef.current;
    const header = document.querySelector<HTMLElement>('.storefront-header');
    const row = header?.querySelector<HTMLElement>('.storefront-nav__row');
    if (!hero || !header || !row) return undefined;
    let frame = 0;

    const update = () => {
      frame = 0;
      const over = hero.getBoundingClientRect().bottom > row.getBoundingClientRect().bottom;
      if (over) header.dataset.overHero = 'true';
      else delete header.dataset.overHero;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      delete header.dataset.overHero;
    };
  }, [heroRef]);
}

/* ── The wall ─────────────────────────────────────────────────────────────────────────────── */

/* A row must always overfill the screen, so a short list is repeated up to this many tiles. */
const MIN_ROW_TILES = 12;
const FRAME_MS = 1000 / 60;
const INERTIA_DECAY = 0.95;
// each row has its own direction and pace, so the wall has depth instead of sliding as one sheet
const PACES = [
  { dir: -1, speed: 34 },
  { dir: 1, speed: 24 },
  { dir: -1, speed: 42 },
  { dir: 1, speed: 30 },
  { dir: -1, speed: 38 },
];

interface PhotoWallProps {
  heroRef: RefObject<HTMLElement | null>;
  photos: WallPhoto[];
  paused: boolean;
  isUr: boolean;
}

// Rows of photo tiles (three on larger screens, five on phones), each an endless strip drawn twice
// for a seamless wrap. Decoration only: no links, no text. Rows crawl on their own, can be grabbed
// and thrown with momentum (the whole stage is the handle, apart from its links and buttons), and
// stop for the pause button, off screen and in a hidden tab; under reduced motion they only move by
// hand. Urdu turns every row the other way.
function PhotoWall({ heroRef, photos, paused, isUr }: PhotoWallProps) {
  const { t } = useTranslation('marketplace');
  const compact = useMediaQuery('(max-width: 767px)');
  const rowCount = compact ? 5 : 3;
  const wallRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const rows = useMemo(() => {
    if (photos.length === 0) return [];
    return Array.from({ length: rowCount }, (_, rowIndex) => {
      const own = photos.filter((_photo, index) => index % rowCount === rowIndex);
      const list = own.length > 0 ? own : photos;
      const repeats = Math.ceil(MIN_ROW_TILES / list.length);
      return Array.from({ length: repeats }, () => list).flat();
    });
  }, [photos, rowCount]);
  const signature = rows.map((row) => row.map((photo) => photo.key).join(',')).join('|');

  useEffect(() => {
    const hero = heroRef.current;
    const wall = wallRef.current;
    if (!hero || !wall || rows.length === 0) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const strips = (Array.from(wall.children) as HTMLElement[]).map((el, index) => ({
      el,
      runLength: rows[index]!.length,
      period: 0,
      offset: -((index + 1) * 137), // rows start out of step with one another
      dir: PACES[index]!.dir * (isUr ? -1 : 1),
      speed: PACES[index]!.speed,
    }));
    let velocity = 0; // px per 60fps frame, so a throw feels the same on any refresh rate
    let dragging = false;
    let lastX = 0;
    let lastT = 0;
    let previous: number | null = null;
    let onScreen = true;
    let frame = 0;

    type Strip = (typeof strips)[number];
    const paint = (strip: Strip) => {
      if (strip.period > 0) {
        while (strip.offset <= -strip.period) strip.offset += strip.period;
        while (strip.offset > 0) strip.offset -= strip.period;
      }
      strip.el.style.transform = `translate3d(${strip.offset.toFixed(2)}px, 0, 0)`;
    };
    const measure = () => {
      strips.forEach((strip) => {
        const first = strip.el.children[0] as HTMLElement | undefined;
        const twin = strip.el.children[strip.runLength] as HTMLElement | undefined;
        if (first && twin) strip.period = twin.offsetLeft - first.offsetLeft;
      });
    };

    const tick = (now: number) => {
      if (previous === null) previous = now;
      const dt = Math.min(now - previous, 100);
      previous = now;
      if (!dragging && onScreen) {
        if (Math.abs(velocity) > 0.1) {
          const frames = dt / FRAME_MS;
          strips.forEach((strip) => {
            strip.offset += velocity * frames * -strip.dir;
            paint(strip);
          });
          velocity *= INERTIA_DECAY ** frames;
        } else {
          velocity = 0;
          if (!pausedRef.current && !reduce.matches) {
            strips.forEach((strip) => {
              strip.offset += strip.dir * strip.speed * (dt / 1000);
              paint(strip);
            });
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target as Element | null)?.closest?.('a, button')) return;
      dragging = true;
      velocity = 0;
      lastX = event.clientX;
      lastT = event.timeStamp;
      hero.setPointerCapture(event.pointerId);
      hero.dataset.dragging = 'true';
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dt = event.timeStamp - lastT;
      if (dt > 0) velocity = (dx / dt) * FRAME_MS;
      lastX = event.clientX;
      lastT = event.timeStamp;
      strips.forEach((strip) => {
        strip.offset += dx * -strip.dir;
        paint(strip);
      });
    };
    const onUp = () => {
      dragging = false;
      delete hero.dataset.dragging;
    };
    const onVisibility = () => { previous = null; };
    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => { onScreen = entries[0]?.isIntersecting ?? true; })
      : null;

    measure();
    strips.forEach(paint);
    hero.addEventListener('pointerdown', onDown);
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerup', onUp);
    hero.addEventListener('pointercancel', onUp);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', measure);
    observer?.observe(hero);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      hero.removeEventListener('pointerdown', onDown);
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerup', onUp);
      hero.removeEventListener('pointercancel', onUp);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
      delete hero.dataset.dragging;
    };
    // rows is covered by its signature
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, isUr, heroRef]);

  return (
    <div className="nw-wall" ref={wallRef} role="img" aria-label={t('hero.showcaseLabel')} dir="ltr">
      {rows.map((row, rowIndex) => (
        <div className="nw-row" key={rowIndex}>
          {[...row, ...row].map((photo, index) => (
            <span className="nw-tile" key={`${photo.key}-${index}`}>
              <img
                src={photo.image}
                alt=""
                decoding="async"
                draggable={false}
                data-trim={photo.trim || undefined}
                // fades in when ready; a photo already in the cache never fires load late
                ref={(el) => { if (el?.complete) el.dataset.loaded = 'true'; }}
                onLoad={(event) => { event.currentTarget.dataset.loaded = 'true'; }}
              />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
