import type { ReactNode } from 'react';
import { Segmented, Typography } from 'antd';
import { ArrowLeft, ArrowRight, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../hooks';
import { AuthSlidePanel } from './AuthSlidePanel';

interface AuthLayoutProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Eyebrow badge shown above the heading on mobile, standing in for the hidden illustration
   * panel (see AuthSlidePanel — a rotating illustration doesn't fit a fixed-viewport phone
   * screen). Defaults to a generic shield so callers that don't pass one still get the badge. */
  icon?: LucideIcon;
}

// Shared chrome for all 5 top-level auth routes (SCR-A01–A04) — Login/Register/OTP/Forgot/Reset.
// Redesign v2: a split panel (AuthSlidePanel, desktop only) replaces the plain centered Card,
// pill-shaped controls (scoped .karobarai-auth-shell CSS in global.css) replace the default AntD
// radius, and the heading is set noticeably larger so it reads as each screen's clear focal
// point. Mobile drops the panel for a compact header row (logo + back + language, all one row)
// plus an eyebrow icon, and treats the viewport as fixed (100dvh) rather than a scrolling page.
export function AuthLayout({ title, subtitle, children, footer, icon: Icon = ShieldCheck }: AuthLayoutProps) {
  const { t } = useTranslation(['auth']);
  const { language, setLanguage, dir } = useLanguage();
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const langSwitch = (
    <Segmented
      size="small"
      value={language}
      onChange={(value) => setLanguage(value as 'EN' | 'UR')}
      options={[
        { label: 'EN', value: 'EN' },
        { label: 'اردو', value: 'UR' },
      ]}
    />
  );

  return (
    <div className="karobarai-auth-shell">
      <AuthSlidePanel />

      <div className="karobarai-auth-header-row">
        <Link to="/" className="karobarai-auth-brand" style={{ textDecoration: 'none' }}>
          <svg width="34" height="34" viewBox="0 0 512 512" aria-hidden="true">
            <rect width="512" height="512" rx="104" className="karobarai-auth-brand-bg" />
            <polygon points="256,150 382,280 130,280" className="karobarai-auth-brand-fg1" />
            <rect x="146" y="280" width="220" height="132" rx="14" className="karobarai-auth-brand-fg2" />
            <circle cx="256" cy="140" r="22" className="karobarai-auth-brand-dot" />
          </svg>
          <span className="karobarai-auth-brand-word">KarobarAI</span>
        </Link>
        <div className="karobarai-auth-header-actions">
          <Link to="/" className="karobarai-auth-back-btn" aria-label={t('auth:backToHome')}>
            <BackIcon size={16} aria-hidden="true" />
          </Link>
          {langSwitch}
        </div>
      </div>

      <div className="karobarai-auth-form-side">
        <div className="karobarai-auth-topbar">
          <Link to="/" className="karobarai-auth-back-btn" aria-label={t('auth:backToHome')}>
            <BackIcon size={16} aria-hidden="true" />
          </Link>
          {langSwitch}
        </div>

        <div className="karobarai-auth-form-wrap">
          <div className="karobarai-auth-card">
            <span className="karobarai-auth-eyebrow-icon">
              <Icon size={18} aria-hidden="true" />
            </span>
            {title && (
              <Typography.Title
                level={3}
                className="karobarai-auth-title"
                style={{ marginTop: 0, marginBottom: subtitle ? 'var(--sp-2)' : 'var(--sp-8)' }}
              >
                {title}
              </Typography.Title>
            )}
            {subtitle && (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 'var(--sp-8)' }}>
                {subtitle}
              </Typography.Paragraph>
            )}
            {children}
            {footer && <div style={{ marginTop: 'var(--sp-7)', textAlign: 'center' }}>{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
