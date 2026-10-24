import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface RailProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Trailing link beside the arrows (e.g. "View all stores"). */
  action?: ReactNode;
  prevLabel: string;
  nextLabel: string;
  /** Item width variant: product cards (4 across) or store cards (3 across). */
  size?: 'product' | 'store';
  items: Array<{ key: string; node: ReactNode }>;
}

// A horizontal shelf for Home: native scroll-snap (swipe on touch, keyboard-reachable links),
// round prev/next arrows beside the heading, mouse drag-to-scroll, soft edge fades while more is
// hidden, and a thin progress bar showing where in the row you are. No autoplay.
export function Rail({ title, subtitle, action, prevLabel, nextLabel, size = 'product', items }: RailProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [progress, setProgress] = useState({ start: 0, width: 1 });
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // RTL reports scrollLeft as 0 → negative; |scrollLeft| is the distance from the start either way.
    const pos = Math.abs(el.scrollLeft);
    setAtStart(pos <= 1);
    setAtEnd(pos >= max - 1);
    const width = el.scrollWidth > 0 ? el.clientWidth / el.scrollWidth : 1;
    setProgress({ start: max > 0 ? (pos / max) * (1 - width) : 0, width });
  }, []);

  useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update, items.length]);

  function scrollByItem(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const item = el.querySelector<HTMLElement>('.rail__item');
    const amount = item ? item.offsetWidth + 18 : el.clientWidth * 0.8;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: (rtl ? -1 : 1) * direction * amount, behavior: 'smooth' });
  }

  // Mouse-only drag to scroll; touch already swipes natively. A drag swallows the click that ends
  // it, so letting go over a card doesn't open it.
  function onPointerDown(event: React.PointerEvent<HTMLUListElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !trackRef.current) return;
    drag.current = { x: event.clientX, left: trackRef.current.scrollLeft, moved: false };
  }
  function onPointerMove(event: React.PointerEvent<HTMLUListElement>) {
    const el = trackRef.current;
    if (!drag.current || !el) return;
    const dx = event.clientX - drag.current.x;
    if (!drag.current.moved && Math.abs(dx) < 6) return;
    if (!drag.current.moved) {
      drag.current.moved = true;
      setDragging(true);
      el.setPointerCapture(event.pointerId);
    }
    el.scrollLeft = drag.current.left - dx;
  }
  function endDrag(event: React.PointerEvent<HTMLUListElement>) {
    if (drag.current?.moved) trackRef.current?.releasePointerCapture(event.pointerId);
    setDragging(false);
    // Keep `moved` until the click fires, then clear.
    window.setTimeout(() => {
      drag.current = null;
    }, 0);
  }

  return (
    <div className="rail" data-size={size}>
      <header className="section-head">
        <div className="section-head-text">
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="section-subtitle">{subtitle}</p>}
        </div>
        <div className="rail__controls">
          {action}
          <div className="featured__arrows">
            <button
              type="button"
              className="featured__arrow featured__arrow--prev"
              aria-label={prevLabel}
              onClick={() => scrollByItem(-1)}
              disabled={atStart}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="featured__arrow featured__arrow--next"
              aria-label={nextLabel}
              onClick={() => scrollByItem(1)}
              disabled={atEnd}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="rail__viewport" data-fade-start={!atStart || undefined} data-fade-end={!atEnd || undefined}>
        <ul
          className="featured__track rail__track"
          ref={trackRef}
          data-dragging={dragging || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={(event) => {
            if (drag.current?.moved) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onDragStart={(event) => event.preventDefault()}
        >
          {items.map((item) => (
            <li key={item.key} className="rail__item">
              {item.node}
            </li>
          ))}
        </ul>
      </div>

      {progress.width < 0.999 && (
        <div className="rail__progress" aria-hidden="true">
          <span style={{ insetInlineStart: `${progress.start * 100}%`, width: `${progress.width * 100}%` }} />
        </div>
      )}
    </div>
  );
}
