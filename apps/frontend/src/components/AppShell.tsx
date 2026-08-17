import type { ReactNode } from 'react';

interface AppShellProps {
  header: ReactNode;
  /** `<Sidebar/>` — Seller/Admin only. Omitted for the Buyer storefront. */
  sidebar?: ReactNode;
  /** `<BottomTabBar/>` — all three roles, CSS-hidden above the mobile breakpoint. */
  bottomTabs?: ReactNode;
  children: ReactNode;
}

// The one shared page shell (UIUX §10, §33) composing header + optional sidebar + content +
// optional mobile bottom nav — used by all three role layouts (StorefrontLayout, SellerLayout,
// AdminLayout) so "how nav/header/content relate" is defined once, not per role. Individual
// screens (Phase D/E) render inside `children` and inherit this same shell automatically.
//
// The sidebar/content split is a plain flex row with the sidebar as the first child — under
// `dir="rtl"` that row mirrors on its own (sidebar lands on the visual right), which is why
// there's no LTR/RTL branching here (UIUX §10, §31).
export function AppShell({ header, sidebar, bottomTabs, children }: AppShellProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {header}
      <div style={{ display: 'flex', flex: 1 }}>
        {sidebar}
        <main className="karobarai-content-area">{children}</main>
      </div>
      {bottomTabs}
    </div>
  );
}
