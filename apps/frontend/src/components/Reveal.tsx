import { createElement, type ElementType, type ReactNode } from 'react';

import { useInView } from '../hooks/useInView';

export interface RevealProps {
  children: ReactNode;
  /** Tag to render. Defaults to a `<div>` so it can wrap any block-level section. */
  as?: ElementType;
  className?: string;
  /** Stagger delay in ms before the fade-up transition starts. */
  delay?: number;
}

// Fade + rise a block into view as it scrolls in. The visual state lives entirely in the `.reveal` /
// `.reveal.is-visible` CSS (opacity/transform only, `--dur-slow`), and the whole effect is stripped
// to static-visible under `prefers-reduced-motion` — both here and in the global stylesheet.
export function Reveal({ children, as = 'div', className, delay = 0 }: RevealProps) {
  const [ref, inView] = useInView<HTMLElement>();

  const classes = ['reveal', inView ? 'is-visible' : null, className].filter(Boolean).join(' ');

  return createElement(
    as,
    {
      ref,
      className: classes,
      style: delay ? { transitionDelay: `${delay}ms` } : undefined,
    },
    children,
  );
}
