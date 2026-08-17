import type { CSSProperties } from 'react';
import { Typography } from 'antd';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  style?: CSSProperties;
}

// A page section (Home's "Browse categories"/"Featured"/"New arrivals", and future Marketplace
// sections) previously had no distinct treatment from a plain `Typography.Title` — no consistent
// rhythm separating "this is a new content group" from any other heading on the page. One shared
// primitive so that rhythm is defined once. Deliberately no built-in "view all" action yet — no
// E2 section currently has a real destination for one (Home's featured/new-arrivals aren't
// separately browsable routes); the prop can be added when a real target exists rather than
// inventing a link to nowhere.
export function SectionHeader({ title, subtitle, style }: SectionHeaderProps) {
  return (
    <div style={{ marginBottom: 'var(--sp-4)', ...style }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
      {subtitle && (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 'var(--sp-1)' }}>
          {subtitle}
        </Typography.Text>
      )}
    </div>
  );
}
