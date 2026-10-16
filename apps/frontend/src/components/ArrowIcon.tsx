import { ArrowRight, type LucideProps } from 'lucide-react';

// Direction-aware right arrow. lucide icons don't auto-mirror under `dir="rtl"`, so the
// `.arrow-icon` class flips it with `scaleX(-1)` in RTL (global.css) — "next" always points
// forward in the reading direction. Decorative by default; pass `aria-hidden={false}` + a label
// only when it carries meaning on its own.
export function ArrowIcon({ className, ...props }: LucideProps) {
  return <ArrowRight aria-hidden="true" className={className ? `arrow-icon ${className}` : 'arrow-icon'} {...props} />;
}
