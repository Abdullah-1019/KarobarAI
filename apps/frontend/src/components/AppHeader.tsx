import type { ReactNode } from 'react';
import { Layout, Segmented, Typography } from 'antd';
import { Link } from 'react-router-dom';

import { useLanguage } from '../hooks';
import { Container } from './Container';

interface AppHeaderProps {
  homeHref: string;
  brandLabel: string;
  /** Full brand lockup (logo mark + wordmark); falls back to `brandLabel` text when omitted. */
  brand?: ReactNode;
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
  /** Buyer only — centers the header row in the shared `Container` so its edges line up with the
   * page sections/footer. Seller/Admin (sidebar layouts) leave this off and stay full-width. */
  contained?: boolean;
}

// The one shared header shell for all three roles (UIUX §33) — replaces what used to be three
// separately hand-rolled headers (StorefrontHeader, SellerLayout's inline header, AdminLayout's
// inline header) with near-identical markup. Role differences are expressed as slots/props, not
// as three copies of this file. The language switcher is built in here rather than passed in
// since it was byte-for-byte identical across all three. Slot order matches the original
// StorefrontHeader exactly: brand, search, language, actions, notifications, account.
//
// The row itself is the `.app-header-row` class, but the height/padding/background stay inline —
// AntD's Layout.Header carries its own injected CSS (padding/height/background) at equal class
// specificity, so an external class isn't guaranteed to win; inline styles always do.
//
// RTL: a plain flex row — under `dir="rtl"` on <html> the row axis mirrors on its own, so
// brand/search/language/actions/account reorder without any LTR/RTL-specific markup here.
export function AppHeader({ homeHref, brandLabel, brand, search, actions, notificationSlot, accountSlot, guestActions, contained = false }: AppHeaderProps) {
  const { language, setLanguage } = useLanguage();

  const row = (
    <>
      {brand ?? (
        <Link to={homeHref} style={{ flexShrink: 0, color: 'inherit' }}>
          <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', color: 'inherit' }}>
            {brandLabel}
          </Typography.Title>
        </Link>
      )}

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
    </>
  );

  return (
    <Layout.Header
      style={{
        height: 64,
        lineHeight: 'normal',
        padding: 0,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Flex row lives on an inner element (not Layout.Header itself) so `contained` can swap the
          wrapper between the centered `Container` (Buyer) and a full-width padded row (Seller/Admin)
          without the header's own injected padding leaking in. */}
      {contained ? (
        <Container className="app-header-row">{row}</Container>
      ) : (
        <div className="app-header-row" style={{ paddingInline: 'var(--sp-6)' }}>
          {row}
        </div>
      )}
    </Layout.Header>
  );
}
