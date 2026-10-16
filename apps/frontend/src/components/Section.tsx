import type { ReactNode } from 'react';

type SectionTone = 'cream' | 'white' | 'mint';

interface SectionProps {
  /** Anchor target for in-page links / skip targets. */
  id?: string;
  /** Background band; defaults to the page canvas so it's seamless. */
  tone?: SectionTone;
  /** Section heading — rendered as the page's `<h2>`s (the hero owns the single `<h1>`). */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Trailing link/button (e.g. "All categories →"), aligned to the inline-end edge. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

// A page-level content band: vertical rhythm + an optional alternating background + a heading row
// (title with the saffron underline accent, subtitle, and a trailing action). Sits directly inside
// the storefront content column, so its edges already match the header/footer container — it does
// not re-wrap in `Container` (which would double the inline padding).
export function Section({ id, tone = 'cream', title, subtitle, action, className, children }: SectionProps) {
  const classes = ['section', `section--${tone}`, className].filter(Boolean).join(' ');

  return (
    <section id={id} className={classes}>
      {(title || action) && (
        <header className="section-head">
          <div className="section-head-text">
            {title && <h2 className="section-title">{title}</h2>}
            {subtitle && <p className="section-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="section-action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
