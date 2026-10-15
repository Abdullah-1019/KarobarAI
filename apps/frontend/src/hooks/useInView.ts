import { useEffect, useRef, useState, type RefObject } from 'react';

interface UseInViewOptions {
  /** Fraction of the element that must be visible to trigger (default 0.15). */
  threshold?: number;
  /** Observer root margin — a negative bottom inset so the animation starts just before the
   * element fully enters the viewport (default `0px 0px -10% 0px`). */
  rootMargin?: string;
  /** Stop observing after the first intersection (default true — reveals play once). */
  once?: boolean;
}

// Reveal-on-scroll primitive (Phase 9). Returns a ref to attach to the element plus whether it has
// entered the viewport. Degrades to "immediately visible" when IntersectionObserver is missing or
// the user prefers reduced motion, so content is never trapped at opacity:0.
export function useInView<T extends HTMLElement = HTMLElement>(
  options: UseInViewOptions = {},
): [RefObject<T | null>, boolean] {
  const { threshold = 0.15, rootMargin = '0px 0px -10% 0px', once = true } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) {
              observer.unobserve(entry.target);
            }
          } else if (!once) {
            setInView(false);
          }
        });
      },
      { threshold, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, inView];
}
