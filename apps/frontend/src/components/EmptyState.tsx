import type { ReactNode } from 'react';
import { PackageSearch } from 'lucide-react';

import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  /** Heading level for the title — h3 by default (an empty state sits inside a page section). */
  headingLevel?: 1 | 2 | 3 | 4;
}

// Calm line-icon + short text + one CTA, per UIUX empty-state pattern (§19: "a calm line
// illustration (single-color, light), one short line, one CTA. Bilingual.") — callers pass
// already-translated strings. A default icon renders when the caller doesn't pass one, so every
// call site gets the "illustration" the spec calls for without having to remember to supply one.
// The icon sits in a peach medallion with a lilac echo; styling lives in global.css (.empty-state).
export function EmptyState({ title, description, actionLabel, onAction, icon, headingLevel = 3 }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        {icon ?? <PackageSearch size={32} strokeWidth={1.5} />}
      </span>
      <Heading className="empty-state__title">{title}</Heading>
      {description && <p className="empty-state__desc">{description}</p>}
      {actionLabel && onAction && (
        <span className="empty-state__action">
          <Button onClick={onAction}>{actionLabel}</Button>
        </span>
      )}
    </div>
  );
}
