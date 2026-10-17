import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  align?: 'start' | 'center';
  className?: string;
}

export function SectionHeader({ title, subtitle, action, align = 'start', className }: SectionHeaderProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: align === 'center' ? 'column' : 'row',
        alignItems: align === 'center' ? 'center' : 'flex-end',
        justifyContent: align === 'center' ? 'center' : 'space-between',
        gap: 'var(--sp-2)',
        textAlign: align === 'center' ? 'center' : 'start',
        marginBottom: 'var(--sp-6)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 'var(--fw-display)', letterSpacing: 'var(--tracking-heading)', fontSize: 'clamp(1.25rem, 2vw, 1.75rem)' }}>{title}</h2>
        {subtitle && <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
