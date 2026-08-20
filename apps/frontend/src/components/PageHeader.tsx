import type { CSSProperties, ReactNode } from 'react';
import { Typography } from 'antd';

import { BackLink } from './BackLink';

interface PageHeaderProps {
  title: string;
  backTo?: string;
  backLabel?: string;
  /** Trailing content — status chip, buttons — rendered end-aligned next to the title. */
  actions?: ReactNode;
  style?: CSSProperties;
}

// E4: the seller area's page-level title row (optional back-link + title + trailing actions/
// status) was hand-rolled slightly differently in SellerProductsPage, AddProductPage, and
// EditProductPage — a title+button flex row in one, a BackLink+title stack in another, a
// BackLink+title+StatusTag row in the third. Named explicitly as a candidate reusable component
// in the E4 brief ("Seller page header"). Distinct from marketplace's SectionHeader (E2), which
// is an in-page sub-section heading, not page-level chrome with a back-link/trailing actions.
export function PageHeader({ title, backTo, backLabel, actions, style }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 'var(--sp-5)', ...style }}>
      {backTo && <BackLink to={backTo} label={backLabel ?? title} />}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--sp-3)',
          flexWrap: 'wrap',
          marginTop: backTo ? 'var(--sp-2)' : 0,
        }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {actions && <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
      </div>
    </div>
  );
}
