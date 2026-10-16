import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { ProductDetailDTO } from '@karobarai/shared';
import { ProductCard } from './ProductCard';

interface FeaturedProductsProps {
  products: ProductDetailDTO[];
}

// Featured rail (Phase 6). A native scroll-snap track rather than a JS carousel/autoplay: it costs
// no dependency, degrades to a plain swipeable row on touch (where the arrows are hidden by CSS),
// and stays keyboard-reachable because the cards inside are links. The arrows are an enhancement
// for mouse users only — shown under `@media (hover: hover)`.
export function FeaturedProducts({ products }: FeaturedProductsProps) {
  const { t } = useTranslation(['marketplace']);
  const trackRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // RTL reports scrollLeft as 0 → negative; |scrollLeft| is the distance from the start in both
    // directions, so one comparison pair covers LTR and RTL.
    const pos = Math.abs(el.scrollLeft);
    setAtStart(pos <= 1);
    setAtEnd(pos >= max - 1);
  }, []);

  useEffect(() => {
    updateEdges();
    const el = trackRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
    };
  }, [updateEdges, products.length]);

  function scrollByCard(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.product-card');
    const amount = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    const rtl = getComputedStyle(el).direction === 'rtl';
    // "next" runs toward the inline-end: +left in LTR, -left in RTL.
    el.scrollBy({ left: (rtl ? -1 : 1) * direction * amount, behavior: 'smooth' });
  }

  return (
    <div className="featured">
      <ul className="featured__track" ref={trackRef}>
        {products.map((product) => (
          <li key={product.id} className="featured__item">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="featured__arrow featured__arrow--prev"
        aria-label={t('featured.prev')}
        onClick={() => scrollByCard(-1)}
        disabled={atStart}
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="featured__arrow featured__arrow--next"
        aria-label={t('featured.next')}
        onClick={() => scrollByCard(1)}
        disabled={atEnd}
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
