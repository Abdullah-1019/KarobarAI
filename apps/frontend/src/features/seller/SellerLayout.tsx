import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { BarChart3, ClipboardList, Package, Settings, Undo2, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useNavigate } from 'react-router-dom';

import { AppHeader, AppShell, BottomTabBar, Sidebar, type NavItem } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { NotificationBell } from '../notifications';
import { logout as logoutApi } from '../auth/authApi';

// Every /seller/* page renders through this layout (including /seller/setup, so a brand-new
// Seller still gets consistent chrome). Phase C: rebuilt on the shared AppShell/AppHeader/Sidebar/
// BottomTabBar — this file is now just the Seller "configuration" layer (nav items, account menu)
// over those shared components, not a hand-rolled header. Primary navigation moved from inline
// header buttons into the new Sidebar; the header keeps only branding, language, notifications,
// and the account menu (same items it always had: Profile + Logout).
//
// "Products" doubles as the Seller's dashboard/landing item — there is no separate /seller
// dashboard route in this app (SellerProductsPage IS what `/seller` renders), so unlike the UIUX
// doc's Dashboard+Products as two sidebar entries, this app has one real route for both; adding a
// second nav item pointing at the same URL would just be a confusing duplicate. "Wallet" has no
// dedicated screen yet either — it resolves via the existing `/seller/*` placeholder route
// (SellerPlaceholder's intended purpose) rather than a route this phase invents.
const SIDEBAR_ITEMS_KEY = ['products', 'orders', 'returns', 'analytics', 'wallet', 'settings'] as const;

export function SellerLayout() {
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

  const menuItems: MenuProps['items'] = [
    { key: 'profile', label: <Link to="/seller/profile">{t('nav.profile')}</Link> },
    { type: 'divider' },
    { key: 'logout', label: t('actions.logout'), onClick: handleLogout },
  ];

  const allItems: Record<(typeof SIDEBAR_ITEMS_KEY)[number], NavItem> = {
    products: { key: 'products', to: '/seller', label: t('nav.products'), icon: Package, exact: true },
    orders: { key: 'orders', to: '/seller/orders', label: t('nav.orders'), icon: ClipboardList },
    returns: { key: 'returns', to: '/seller/returns', label: t('nav.returns'), icon: Undo2 },
    analytics: { key: 'analytics', to: '/seller/analytics', label: t('nav.analytics'), icon: BarChart3 },
    wallet: { key: 'wallet', to: '/seller/wallet', label: t('nav.wallet'), icon: Wallet },
    settings: { key: 'settings', to: '/seller/profile/settings', label: t('nav.adminConfig'), icon: Settings },
  };
  const sidebarItems = SIDEBAR_ITEMS_KEY.map((key) => allItems[key]);
  // 5 max per §15 — mobile drops Wallet (still reachable from the desktop/tablet sidebar).
  const bottomTabItems = sidebarItems.filter((item) => item.key !== 'wallet');

  return (
    <AppShell
      header={
        <AppHeader
          homeHref="/seller"
          brandLabel="KarobarAI"
          notificationSlot={<NotificationBell />}
          accountSlot={
            <Dropdown menu={{ items: menuItems }}>
              <Button>{t('nav.profile')}</Button>
            </Dropdown>
          }
        />
      }
      sidebar={<Sidebar items={sidebarItems} ariaLabel={t('landmarks.sellerNav')} />}
      bottomTabs={<BottomTabBar items={bottomTabItems} ariaLabel={t('landmarks.sellerNav')} />}
    >
      <Outlet />
    </AppShell>
  );
}
