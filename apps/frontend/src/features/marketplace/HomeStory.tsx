import { useRef, type CSSProperties, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { ProductDetailDTO } from '@karobarai/shared';
import { Button, PriceDisplay } from '../../components';
import { useLanguage, useMediaQuery } from '../../hooks';
import { Hero } from './Hero';
import { useHomePhotos, type StoryProduct } from './homePhotos';
import type { StoreDirectoryItem } from './storeApi';
import { useHomeStory, useSmoothWheel } from './useHomeStory';
import './homeStory.css';

interface HomeStoryProps {
  /** Real products from the home feed — a source for the photo wall alongside the featured stores. */
  products?: ProductDetailDTO[];
  /** Featured stores (the same query the "Stores" section uses) — the main photo source. */
  stores?: StoreDirectoryItem[];
  storesLoading?: boolean;
  /** Where "Skip to shops" lands. */
  skipTargetId: string;
}

const ROUTE_WIDE = 'M720 540C720 470 640 470 640 400C640 320 860 380 960 300C1060 230 1010 130 1180 110';
const ROUTE_COMPACT = 'M300 480C300 400 210 410 210 360C210 300 330 360 430 300C510 250 430 170 520 130';

/** Mirrors an absolute path of x y pairs around the 1280-wide map (Urdu runs right to left). */
function mirrorRoute(path: string): string {
  let isX = true;
  return path.replace(/-?\d+(?:\.\d+)?/g, (value) => {
    const out = isX ? String(1280 - Number(value)) : value;
    isX = !isX;
    return out;
  });
}

// The home page's story: the hero's wall, then one product (the perfume) carried by scroll through
// four cards in the order someone really buys: ask, pay, track, return. It closes back on the
// product with the call to shop. useHomeStory measures where everything rests and drives the
// travelling photo, the cards and the brand circles. Phones and reduced motion get the same cards
// with the photo set in place. Every card's product UI is an illustration, marked as an example
// where it shows a result.
export function HomeStory({ products = [], stores = [], storesLoading = false, skipTargetId }: HomeStoryProps) {
  const { t, i18n } = useTranslation('marketplace');
  const { language } = useLanguage();
  const isUr = language === 'UR';
  const compact = useMediaQuery('(max-width: 767px)');
  const rootRef = useRef<HTMLDivElement>(null);
  const { photos, story } = useHomePhotos(stores, products, storesLoading);

  useHomeStory(rootRef, { image: story?.image ?? null, isUr, compact });
  useSmoothWheel(!compact);

  const other = i18n.getFixedT(isUr ? 'en' : 'ur', 'marketplace');
  const twinProps = { lang: isUr ? 'en' : 'ur', dir: isUr ? 'ltr' : 'rtl' } as const;
  const twinOf = (key: string) => `${other(`story.${key}.head`)} ${other(`story.${key}.accent`)}`;

  const onSkip = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(skipTargetId);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ block: 'start' });
  };

  const route = compact ? ROUTE_COMPACT : isUr ? mirrorRoute(ROUTE_WIDE) : ROUTE_WIDE;

  return (
    <div className="st-root" ref={rootRef}>
      <div className="st-page-glows" aria-hidden="true">
        <span className="st-glow st-glow--peach" data-glow="0" />
        <span className="st-glow st-glow--lilac" data-glow="1" />
      </div>
      {story && (
        <div className="st-actor" aria-hidden="true">
          <img src={story.image} alt="" draggable={false} />
        </div>
      )}

      <div className="st-hero-track">
        <Hero photos={photos} story={story} />
      </div>

      <section className="st-section" aria-labelledby="st-title">
        <header className="st-head">
          <h2 id="st-title">{t('story.title')}</h2>
          <p {...twinProps}>{other('story.title')}</p>
          <a className="st-skip" href={`#${skipTargetId}`} onClick={onSkip}>{t('story.skip')}</a>
        </header>

        <ol className="st-bar" aria-hidden="true">
          {story && <img src={story.image} alt="" />}
          {(['ask', 'pay', 'track', 'ret'] as const).map((key) => (
            <li key={key}><i /><span>{t(`story.bar.${key}`)}</span></li>
          ))}
        </ol>

        <div className="st-marker" />
        <StoryCard tone="ink" name="ask" twin={twinOf('ask')} twinProps={twinProps}>
          <div className="st-chat">
            <header className="st-chat__head">
              <span className="st-chat__av">{story?.storeName.charAt(0).toUpperCase() ?? 'K'}</span>
              <div><b dir="auto">{story?.storeName ?? 'KarobarAI'}</b><small>{t('story.ask.seller')}</small></div>
              <span className="st-chip">{t('story.ask.example')}</span>
            </header>
            <div className="st-chat__log">
              <Slot name="ask" className="st-slot--chat" story={story} at={0.02} />
              <p className="st-msg st-msg--me" lang="ur" dir="rtl" data-at="0.24">{t('story.ask.m1')}</p>
              <p className="st-msg st-msg--them" lang="ur" dir="rtl" data-at="0.4">{t('story.ask.m2')}</p>
              <p className="st-msg st-msg--me" lang="en" dir="ltr" data-at="0.56">{t('story.ask.m3')}</p>
              <p className="st-msg st-msg--them" lang="en" dir="ltr" data-at="0.72">{t('story.ask.m4')}</p>
              <span className="st-typing" data-at="0.86"><i /><i /><i /></span>
            </div>
            <div className="st-composer"><span>{t('story.ask.write')}</span><i aria-hidden="true">↑</i></div>
          </div>
        </StoryCard>

        <div className="st-marker" />
        <StoryCard tone="peach" flip name="pay" twin={twinOf('pay')} twinProps={twinProps}>
          <div className="st-order">
            <Slot name="pay" className="st-slot--order" story={story} />
            <div className="st-order__col">
              <div className="st-toast" data-at="0.1"><i>✓</i>{t('story.pay.placed')}</div>
              <div className="st-rcpt" data-at="0.26">
                {story && <div><span>{t('story.pay.item')}</span><b dir="auto">{(isUr && story.titleUr) || story.titleEn}</b></div>}
                <div><span>{t('story.pay.payment')}</span><b>{t('story.pay.cod')}</b></div>
                {story && <div className="st-rcpt__total"><span>{t('story.pay.total')}</span><PriceDisplay amount={story.price} strong /></div>}
              </div>
              <ol className="st-ticks" data-at="0.4">
                <li><i>✓</i>{t('story.track.shipped')}</li>
                <li><i>✓</i>{t('story.track.out')}</li>
                <li><i>✓</i>{t('story.pay.atDoor')}</li>
              </ol>
              <div className="st-notes" data-at="0.52"><span className="st-note" /><span className="st-note" /><span className="st-note" /></div>
              <div className="st-paybar" data-at="0.62">
                <span className="st-paybar__due">{t('story.pay.pay')}{story && <> <PriceDisplay amount={story.price} /></>}</span>
                <span className="st-paybar__done">✓ {t('story.pay.paid')}</span>
              </div>
            </div>
          </div>
        </StoryCard>

        <div className="st-marker" />
        <StoryCard tone="lilac" full hold="42svh" name="track" twin={twinOf('track')} twinProps={twinProps} demoClass="st-map-box">
          <svg className="st-map" viewBox={compact ? '0 0 640 520' : '0 0 1280 600'} preserveAspectRatio="xMidYMid slice">
            {compact ? (
              <g>
                <rect className="st-block" x="40" y="30" width="150" height="110" rx="14" /><rect className="st-block" x="230" y="20" width="170" height="130" rx="14" /><rect className="st-block" x="450" y="60" width="160" height="110" rx="14" /><rect className="st-block" x="60" y="190" width="130" height="130" rx="14" /><rect className="st-block" x="250" y="210" width="150" height="110" rx="14" /><rect className="st-block" x="450" y="220" width="170" height="120" rx="14" /><rect className="st-block" x="250" y="380" width="170" height="120" rx="14" /><rect className="st-block" x="470" y="400" width="150" height="100" rx="14" />
                <path className="st-road" d="M-20 170H660M-20 360H660M210 -20V540M430 -20V540M-20 40C200 80 400 30 660 190" />
                <circle className="st-pin" cx="300" cy="480" r="10" /><circle className="st-pin" cx="520" cy="130" r="10" />
                <text x="322" y="486">{t('story.track.store')}</text><text x="538" y="116">{t('story.track.door')}</text>
              </g>
            ) : (
              <>
                <g transform={isUr ? 'translate(1280 0) scale(-1 1)' : undefined}>
                  <rect className="st-block" x="560" y="24" width="170" height="130" rx="16" /><rect className="st-block" x="770" y="30" width="190" height="120" rx="16" /><rect className="st-block" x="1000" y="150" width="240" height="130" rx="16" /><rect className="st-block" x="560" y="200" width="170" height="130" rx="16" /><rect className="st-block" x="780" y="400" width="190" height="150" rx="16" /><rect className="st-block" x="1010" y="340" width="230" height="110" rx="16" /><rect className="st-block" x="520" y="440" width="150" height="130" rx="16" /><rect className="st-block" x="60" y="30" width="400" height="120" rx="16" /><rect className="st-block" x="60" y="470" width="360" height="110" rx="16" />
                  <path className="st-road" d="M-20 180H1300M-20 370H1300M750 -20V620M990 -20V620M500 -20V620M-20 60C300 110 800 20 1300 240" />
                  <circle className="st-pin" cx="720" cy="540" r="11" /><circle className="st-pin" cx="1180" cy="110" r="11" />
                </g>
                <text x={isUr ? 596 : 744} y="546" textAnchor={isUr ? 'end' : 'start'}>{t('story.track.store')}</text>
                <text x={isUr ? 160 : 1120} y="86" textAnchor={isUr ? 'end' : 'start'}>{t('story.track.door')}</text>
              </>
            )}
            <path className="st-route-base" d={route} />
            <path className="st-route-done" d={route} />
          </svg>
          <div className="st-notice">
            {(['confirmed', 'shipped', 'out', 'delivered'] as const).map((key) => (
              <div key={key} className="st-notice__item"><b>{t(`story.track.${key}`)}</b><small>{t(`story.track.${key}Note`)}</small></div>
            ))}
          </div>
          <ol className="st-tl">
            {(['confirmed', 'shipped', 'out', 'delivered'] as const).map((key) => (
              <li key={key}><i />{t(`story.track.${key}`)}</li>
            ))}
          </ol>
        </StoryCard>

        <div className="st-marker" />
        <StoryCard tone="orange" flip name="ret" twin={twinOf('ret')} twinProps={twinProps}>
          <div className="st-ret">
            <div className="st-ret__a">
              <small>{t('story.ret.listing')}</small>
              <Slot name="ret" className="st-slot--ret" story={story} />
            </div>
            <div className="st-phone" data-at="0.08">
              {story && <img src={story.image} alt="" draggable={false} />}
              <span className="st-phone__tag">{t('story.ret.tag')}</span>
              <span className="st-corners" /><span className="st-scan" /><span className="st-shutter" /><span className="st-flash" />
            </div>
            <div className="st-gauge" data-at="0.5">
              <svg viewBox="0 0 240 132" aria-hidden="true">
                <path d="M26 120A94 94 0 0 1 90.9 30.6" fill="none" stroke="#e0a79a" strokeWidth="14" strokeLinecap="round" />
                <path d="M97.3 28.8A94 94 0 0 1 174.9 43.6" fill="none" stroke="#e8c98a" strokeWidth="14" />
                <path d="M180.4 48A94 94 0 0 1 214 120" fill="none" stroke="#2f8f6b" strokeWidth="14" strokeLinecap="round" />
                <g className="st-needle"><line x1="120" y1="120" x2="120" y2="44" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><circle cx="120" cy="120" r="8" fill="currentColor" /></g>
              </svg>
              <p className="st-outcome"><span className="st-outcome__wait">{t('story.ret.comparing')}</span><span className="st-outcome__done">{t('story.ret.match')}</span></p>
              <em>{t('story.ret.example')}</em>
            </div>
          </div>
        </StoryCard>
        <div className="st-rest" aria-hidden="true" />
      </section>

      <section className="st-closing" aria-labelledby="st-close-title">
        <span className="st-slot st-slot--close" data-slot="close">
          {story && <img src={story.image} alt="" draggable={false} />}
        </span>
        <h2 id="st-close-title">{t('story.close.head')} <b>{t('story.close.accent')}</b></h2>
        <p {...twinProps}>{`${other('story.close.head')} ${other('story.close.accent')}`}</p>
        <Button variant="cta" to="/search" arrow>{t('hero.shopNow')}</Button>
      </section>
    </div>
  );
}

function Slot({ name, className, story, at }: { name: string; className: string; story: StoryProduct | null; at?: number }) {
  return (
    <span className={`st-slot ${className}`} data-slot={name} data-at={at}>
      {story && <img src={story.image} alt="" draggable={false} />}
    </span>
  );
}

interface StoryCardProps {
  tone: 'ink' | 'peach' | 'lilac' | 'orange';
  name: 'ask' | 'pay' | 'track' | 'ret';
  twin: string;
  twinProps: { lang: string; dir: 'ltr' | 'rtl' };
  flip?: boolean;
  full?: boolean;
  hold?: string;
  demoClass?: string;
  children: React.ReactNode;
}

function StoryCard({ tone, name, twin, twinProps, flip, full, hold, demoClass, children }: StoryCardProps) {
  const { t } = useTranslation('marketplace');
  const classes = ['st-card', `st-card--${tone}`, flip && 'st-card--flip', full && 'st-card--full'].filter(Boolean).join(' ');
  const words = t(`story.${name}.head`).split(' ');
  const accent = t(`story.${name}.accent`).split(' ');
  return (
    <article className={classes} data-card={name} style={hold ? ({ '--hold': hold } as CSSProperties) : undefined}>
      <span className="st-glow st-glow--peach" data-glow="0" aria-hidden="true" />
      <span className="st-glow st-glow--lilac" data-glow="1" aria-hidden="true" />
      <div className="st-copy">
        <h3>
          {words.map((word, index) => (
            <span key={index}><span className="st-word" style={{ '--w': index } as CSSProperties}>{word}</span> </span>
          ))}
          {accent.map((word, index) => (
            <span key={`a-${index}`}><span className="st-word st-word--hl" style={{ '--w': words.length + index } as CSSProperties}>{word}</span> </span>
          ))}
        </h3>
        <p className="st-twin" {...twinProps}>{twin}</p>
        <p className="st-body">{t(`story.${name}.body`)}</p>
      </div>
      <div className={`st-demo${demoClass ? ` ${demoClass}` : ''}`} aria-hidden="true">{children}</div>
    </article>
  );
}
