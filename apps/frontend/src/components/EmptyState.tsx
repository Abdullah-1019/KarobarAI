import type { ReactNode } from 'react';
import { Button, Typography } from 'antd';
import { PackageSearch } from 'lucide-react';

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
export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--sp-10) var(--sp-6)',
        color: 'var(--text-secondary)',
      }}
    >
      {icon ?? <PackageSearch size={40} strokeWidth={1.5} color="var(--text-disabled)" aria-hidden="true" />}
      <Typography.Title level={4} style={{ marginTop: 'var(--sp-3)', marginBottom: 'var(--sp-1)' }}>
        {title}
      </Typography.Title>
      {description && <Typography.Text type="secondary">{description}</Typography.Text>}
      {actionLabel && onAction && (
        <Button type="primary" onClick={onAction} style={{ marginTop: 'var(--sp-4)' }}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
