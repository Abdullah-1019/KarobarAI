import type { ReactNode } from 'react';
import { Layout, Segmented, Typography } from 'antd';
import { Link } from 'react-router-dom';

import { useLanguage } from '../hooks';

interface AppHeaderProps {
  homeHref: string;
  brandLabel: string;
  /** Buyer only — the storefront search bar. Fills the header's flexible middle space; when
   * omitted (Seller/Admin), that same space just acts as a spacer pushing the rest to the end. */
  search?: ReactNode;
  /** Role-specific extra action between the language switcher and notifications (e.g. Buyer's cart button). */
  actions?: ReactNode;
  /** `<NotificationBell/>` for authenticated users, omitted for guests. */
  notificationSlot?: ReactNode;
  /** Account dropdown for authenticated users — stays visible at every width, mobile included,
   * since logout lives only here. */
  accountSlot?: ReactNode;
  /** Guest login/register CTAs — hidden at mobile widths, where the BottomTabBar's Account tab
   * already routes a guest to /login, matching UIUX §10's mobile top bar (brand + language + bell
   * only). Desktop/tablet keep showing them, same as before. */
  guestActions?: ReactNode;
}

// The one shared header shell for all three roles (UIUX §33) — replaces what used to be three
// separately hand-rolled headers (StorefrontHeader, SellerLayout's inline header, AdminLayout's
// inline header) with near-identical markup. Role differences are expressed as slots/props, not
// as three copies of this file. The language switcher is built in here rather than passed in
// since it was byte-for-byte identical across all three. Slot order matches the original
// StorefrontHeader exactly: brand, search, language, actions, notifications, account.
//
// Inline styles (not a CSS class) deliberately, same as the three headers this replaces — AntD's
// Layout.Header carries its own injected CSS (padding/height/background) at equal class
// specificity, so an external stylesheet class isn't guaranteed to win; inline styles always do.
// CSS classes are reserved for Sidebar/BottomTabBar/content-area, which need real media queries.
//
// RTL: a plain flex row (`display:flex`, default row axis) — under `dir="rtl"` on <html> the row
// axis mirrors on its own, so brand/search/language/actions/account reorder without any
// LTR/RTL-specific markup here.
export function AppHeader({ homeHref, brandLabel, search, actions, notificationSlot, accountSlot, guestActions }: AppHeaderProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <Layout.Header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        height: 64,
        lineHeight: 'normal',
        padding: '0 var(--sp-6)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <Link to={homeHref} style={{ flexShrink: 0, color: 'inherit' }}>
        <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', color: 'inherit' }}>
          {brandLabel}
        </Typography.Title>
      </Link>

      {search && (
        <div className="karobarai-app-header-search" style={{ flex: 1, minWidth: 0 }}>
          {search}
        </div>
      )}
      {!search && <div style={{ flex: 1, minWidth: 0 }} />}

      <Segmented
        size="small"
        value={language}
        onChange={(value) => setLanguage(value as 'EN' | 'UR')}
        options={[
          { label: 'EN', value: 'EN' },
          { label: 'اردو', value: 'UR' },
        ]}
      />

      {actions && <span className="karobarai-app-header-actions">{actions}</span>}
      {notificationSlot}
      {accountSlot}
      {guestActions && <span className="karobarai-app-header-guest-actions">{guestActions}</span>}
    </Layout.Header>
  );
}
