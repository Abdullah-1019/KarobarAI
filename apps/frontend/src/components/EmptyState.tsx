import type { ReactNode } from 'react';
import { Button, Typography } from 'antd';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

// Calm line-icon + short text + one CTA, per UIUX empty-state pattern (§ "Each: a calm line
// illustration, one short line, one CTA. Bilingual.") — callers pass already-translated strings.
export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--sp-10, 40px) var(--sp-6, 24px)',
        color: 'var(--text-secondary)',
      }}
    >
      {icon}
      <Typography.Title level={4} style={{ marginTop: 12, marginBottom: 4 }}>
        {title}
      </Typography.Title>
      {description && <Typography.Text type="secondary">{description}</Typography.Text>}
      {actionLabel && onAction && (
        <Button type="primary" onClick={onAction} style={{ marginTop: 16 }}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
