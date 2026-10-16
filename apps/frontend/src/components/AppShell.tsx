import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface AppShellProps {
  header: ReactNode;
  /** `<Sidebar/>` — Seller/Admin only. Omitted for the Buyer storefront. */
  sidebar?: ReactNode;
  /** `<BottomTabBar/>` — all three roles, CSS-hidden above the mobile breakpoint. */
  bottomTabs?: ReactNode;
  /** Site footer — currently the Buyer storefront only. Rendered after the content row. */
  footer?: ReactNode;
  children: ReactNode;
}

// The one shared page shell (UIUX §10, §33) composing header + optional sidebar + content +
// optional mobile bottom nav — used by all three role layouts (StorefrontLayout, SellerLayout,
// AdminLayout) so "how nav/header/content relate" is defined once, not per role. Individual
// screens (Phase D/E) render inside `children` and inherit this same shell automatically.
//
// The sidebar/content split is a plain flex row with the sidebar as the first child — under
// `dir="rtl"` that row mirrors on its own (sidebar lands on the visual right), which is why
// there's no LTR/RTL branching here (UIUX §10, §31). A "skip to content" link is the first
// focusable element (keyboard users jump past the nav); `<main>` is its target and is
// programmatically focusable so focus actually moves there.
export function AppShell({ header, sidebar, bottomTabs, footer, children }: AppShellProps) {
  const { t } = useTranslation('common');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <a href="#main-content" className="skip-link">
        {t('a11y.skipToContent')}
      </a>
      {header}
      <div style={{ display: 'flex', flex: 1 }}>
        {sidebar}
        <main id="main-content" tabIndex={-1} className="karobarai-content-area">
          {children}
        </main>
      </div>
      {footer}
      {bottomTabs}
    </div>
  );
}
