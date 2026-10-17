import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ProductImageDTO } from '@karobarai/shared';

interface ProductGalleryProps {
  images: ProductImageDTO[];
  /** The category tint the product stands on (same ground as its card). */
  tint: string;
  title: string;
  /** Pills pinned to the top inline-start corner (AI-written, New, Only X left). */
  badges?: ReactNode;
  /** The save heart, pinned to the top inline-end corner. */
  corner?: ReactNode;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The product page's one signature motion (DESIGN-CONSULT §7: "Product page: the gallery").
// - On arrival the product settles onto its tinted counter: it starts already visible, slightly low
//   and small, and eases to rest while its ground shadow firms up (transform/opacity only).
// - On a mouse, the stage becomes a loupe: the image scales 1.8× around the pointer so a buyer can
//   look at stitching or a label, and lets go when the pointer leaves.
// - Several photos sit on a native scroll-snap track (swipe on phones, keyboard-reachable thumbs
//   on desktop), so there is no JS carousel to fight with and RTL works by itself.
// Reduced motion: no settle, no loupe, instant jumps between photos.
export function ProductGallery({ images, tint, title, badges, corner }: ProductGalleryProps) {
  const { t } = useTranslation('marketplace');
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const total = images.length;

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    // |scrollLeft| covers RTL, where scrollLeft runs negative from 0.
    setActive(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  function goTo(index: number) {
    const el = trackRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollTo({ left: (rtl ? -1 : 1) * index * el.clientWidth, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    setActive(index);
  }

  function onLoupeMove(event: PointerEvent<HTMLLIElement>) {
    if (event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--loupe-x', `${((event.clientX - box.left) / box.width) * 100}%`);
    event.currentTarget.style.setProperty('--loupe-y', `${((event.clientY - box.top) / box.height) * 100}%`);
  }

  return (
    <div className="pdp-gallery" aria-label={t('pdp.gallery')} role="region">
      <div className="pdp-stage" style={{ ['--stage-tint' as string]: tint }}>
        {total > 0 ? (
          <ul ref={trackRef} className="pdp-stage__track" tabIndex={total > 1 ? 0 : -1}>
            {images.map((image, index) => (
              <li
                key={image.id}
                className="pdp-stage__slide"
                aria-label={total > 1 ? t('pdp.imageOf', { index: index + 1, total }) : undefined}
                onPointerMove={onLoupeMove}
              >
                {failed[image.id] ? (
                  <ImageOff className="pdp-stage__missing" size={40} strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <img
                    className="pdp-stage__img"
                    src={image.url}
                    alt={index === 0 ? title : ''}
                    // The first photo is the page's largest paint; the rest wait for a swipe.
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    onError={() => setFailed((current) => ({ ...current, [image.id]: true }))}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="pdp-stage__slide">
            <ImageOff className="pdp-stage__missing" size={40} strokeWidth={1.5} aria-hidden="true" />
          </div>
        )}
        {badges && <div className="pdp-stage__badges">{badges}</div>}
        {corner && <div className="pdp-stage__corner">{corner}</div>}
        {total > 1 && (
          <span className="pdp-stage__count" dir="ltr" aria-hidden="true">
            {active + 1} / {total}
          </span>
        )}
      </div>

      {total > 1 && (
        <div className="pdp-thumbs">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className="pdp-thumbs__btn"
              style={{ background: tint }}
              aria-label={t('pdp.showImage', { index: index + 1, total })}
              aria-current={index === active ? 'true' : undefined}
              onClick={() => goTo(index)}
            >
              <img src={image.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
