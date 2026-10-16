import { useEffect, useState } from 'react';

// True once the page has scrolled past `threshold` px. Used by the storefront navbar to shrink
// its height and switch on the translucent backdrop-blur. Reads are coalesced into a
// requestAnimationFrame so a fast scroll doesn't cause a state update per scroll event, and the
// listener is passive so it never blocks scrolling.
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > threshold);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrolled(window.scrollY > threshold);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return scrolled;
}
