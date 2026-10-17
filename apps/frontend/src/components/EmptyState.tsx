import type { ReactNode } from 'react';
import { PackageSearch } from 'lucide-react';

import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

// Calm line-icon + short text + one CTA, per UIUX empty-state pattern (§19: "a calm line
// illustration (single-color, light), one short line, one CTA. Bilingual.") — callers pass
// already-translated strings. A default icon renders when the caller doesn't pass one, so every
// call site gets the "illustration" the spec calls for without having to remember to supply one.
// The icon sits in a sand medallion; styling lives in global.css (.empty-state).
export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        {icon ?? <PackageSearch size={32} strokeWidth={1.5} />}
      </span>
      <h4 className="empty-state__title">{title}</h4>
      {description && <p className="empty-state__desc">{description}</p>}
      {actionLabel && onAction && (
        <span className="empty-state__action">
          <Button onClick={onAction}>{actionLabel}</Button>
        </span>
      )}
    </div>
  );
}
