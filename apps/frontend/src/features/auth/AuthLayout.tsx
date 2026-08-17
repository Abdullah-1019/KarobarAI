import type { ReactNode } from 'react';
import { Card, Segmented, Typography } from 'antd';
import { Link } from 'react-router-dom';

import { useLanguage } from '../../hooks';

interface AuthLayoutProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

// Shared chrome for all 5 top-level auth routes (SCR-A01–A04) — Login/Register/OTP/Forgot/Reset
// each rendered the exact same `maxWidth:420, margin:'0 auto', padding:'var(--sp-6)'` div, up to
// 4x per file for their own success/error sub-states, with no brand mark, no Card surface (UIUX
// §13), and a language switcher that only Register happened to build for itself — every other
// auth screen had no way to switch languages at all. This consolidates that into one place: a
// brand wordmark (matching AppHeader's, since these routes render outside AppShell/AppHeader
// entirely — App Flow's literal top-level auth paths), a language switcher always reachable
// (UIUX §15), and the Card surface every other detail/settings screen in the app already uses.
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--sp-8) var(--sp-4)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--sp-6)',
        }}
      >
        <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
          <Typography.Title level={3} style={{ margin: 0, color: 'var(--brand-primary)' }}>
            KarobarAI
          </Typography.Title>
        </Link>
        <Segmented
          size="small"
          value={language}
          onChange={(value) => setLanguage(value as 'EN' | 'UR')}
          options={[
            { label: 'EN', value: 'EN' },
            { label: 'اردو', value: 'UR' },
          ]}
        />
      </div>

      <Card style={{ width: '100%', maxWidth: 420 }} styles={{ body: { padding: 'var(--sp-6)' } }}>
        {title && (
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: subtitle ? 'var(--sp-2)' : 'var(--sp-5)' }}>
            {title}
          </Typography.Title>
        )}
        {subtitle && (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 'var(--sp-5)' }}>
            {subtitle}
          </Typography.Paragraph>
        )}
        {children}
      </Card>

      {footer && <div style={{ width: '100%', maxWidth: 420, marginTop: 'var(--sp-5)', textAlign: 'center' }}>{footer}</div>}
    </div>
  );
}
