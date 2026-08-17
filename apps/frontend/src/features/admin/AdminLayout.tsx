import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { FileClock, LayoutDashboard, Scale, Settings, ShieldCheck, TrendingUp, Users, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';

import { AppHeader, AppShell, BottomTabBar, Sidebar, type NavItem } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { NotificationBell } from '../notifications';
import { logout as logoutApi } from '../auth/authApi';

// Every /admin/* page renders through this layout. Phase C: rebuilt on the shared AppShell/
// AppHeader/Sidebar/BottomTabBar, mirroring SellerLayout.tsx's shape. Support sees the same nav as
// Admin (every /admin/* read endpoint is Admin+Support); individual pages gate their own write
// actions off `user.role === 'ADMIN'`, not this layout — unchanged from before.
//
// "Overview" reuses the existing nav.dashboard label/route (/admin) rather than a new "Overview"
// string, since it's the same landing page concept Seller already calls "Dashboard". "Disputes"
// maps onto the existing /admin/returns route (already titled "Returns Management" — its
// ReturnStatus values include UNDER_DISPUTE) rather than a separate screen. "Payments" and
// "Audit" have no dedicated screens yet, so they resolve via the existing `/admin/*` placeholder
// route (AdminPlaceholder's intended purpose), the same pattern SellerLayout uses for "Wallet".
// "Reports" isn't in the UIUX doc's Phase C list but is a real, already-built screen (F11/F12)
// that the old header exposed — kept in the sidebar so nothing already reachable regresses.
const SIDEBAR_ITEMS_KEY = [
  'overview',
  'users',
  'payments',
  'disputes',
  'moderation',
  'reports',
  'config',
  'audit',
] as const;
// 5 max per §15 — mobile keeps the most operationally urgent items (status, identity, and the two
// review queues) and drops Payments/Reports/Audit, still reachable from the desktop/tablet sidebar.
const BOTTOM_TAB_KEYS = ['overview', 'users', 'moderation', 'disputes', 'config'] as const;

export function AdminLayout() {
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);

  async function handleLogout() {
    try {
      await logoutApi();
    } catch {
      // The local session is cleared regardless — a failed revoke call shouldn't trap the
      // user in a header that still looks logged in.
    } finally {
      clearSession();
      navigate('/login');
    }
  }

  // No /admin/profile screen exists for Admin/Support roles — this trigger only opens Logout,
  // same as before Phase C.
  const menuItems: MenuProps['items'] = [{ key: 'logout', label: t('actions.logout'), onClick: handleLogout }];

  const allItems: Record<(typeof SIDEBAR_ITEMS_KEY)[number], NavItem> = {
    overview: { key: 'overview', to: '/admin', label: t('nav.dashboard'), icon: LayoutDashboard, exact: true },
    users: { key: 'users', to: '/admin/users', label: t('nav.adminUsers'), icon: Users },
    payments: { key: 'payments', to: '/admin/payments', label: t('nav.payments'), icon: Wallet },
    disputes: { key: 'disputes', to: '/admin/returns', label: t('nav.returns'), icon: Scale },
    moderation: { key: 'moderation', to: '/admin/moderation', label: t('nav.adminModeration'), icon: ShieldCheck },
    reports: { key: 'reports', to: '/admin/reports', label: t('nav.adminReports'), icon: TrendingUp },
    config: { key: 'config', to: '/admin/config', label: t('nav.adminConfig'), icon: Settings },
    audit: { key: 'audit', to: '/admin/audit', label: t('nav.audit'), icon: FileClock },
  };
  const sidebarItems = SIDEBAR_ITEMS_KEY.map((key) => allItems[key]);
  const bottomTabItems = BOTTOM_TAB_KEYS.map((key) => allItems[key]);

  return (
    <AppShell
      header={
        <AppHeader
          homeHref="/admin"
          brandLabel="KarobarAI Admin"
          notificationSlot={<NotificationBell />}
          accountSlot={
            <Dropdown menu={{ items: menuItems }}>
              <Button>{t('nav.admin')}</Button>
            </Dropdown>
          }
        />
      }
      sidebar={<Sidebar items={sidebarItems} ariaLabel={t('landmarks.adminNav')} />}
      bottomTabs={<BottomTabBar items={bottomTabItems} ariaLabel={t('landmarks.adminNav')} />}
    >
      <Outlet />
    </AppShell>
  );
}
