import { Badge, Button, Dropdown, Space } from 'antd';
import type { MenuProps } from 'antd';
import { ClipboardList, Home, Search, ShoppingCart, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useNavigate } from 'react-router-dom';

import { AppHeader, AppShell, BottomTabBar, type NavItem } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { logout as logoutApi } from '../auth/authApi';
import { useCartCount } from '../cart/useCartCount';
import { useGuestCartMerge } from '../cart/useGuestCartMerge';
import { NotificationBell } from '../notifications';
import { SearchBar } from './SearchBar';

// Route-layout element wrapping every storefront-facing route (home, search, product detail,
// cart, and the buyer-protected checkout/orders group) — see app/router.tsx. Was previously
// StorefrontLayout (bare Outlet wrapper) + a separate StorefrontHeader component; folded into one
// file since StorefrontHeader had no other consumer and this is now the Buyer "configuration"
// layer over the shared AppShell/AppHeader/BottomTabBar (Phase C).
export function StorefrontLayout() {
  useGuestCartMerge();

  const { t } = useTranslation(['common', 'marketplace']);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const cartCount = useCartCount();

  async function handleLogout() {
    try {
      await logoutApi();
    } catch {
      // The local session is cleared regardless — a failed revoke call shouldn't trap the
      // user in a header that still looks logged in.
    } finally {
      clearSession();
      navigate('/');
    }
  }

  // Unchanged from the old StorefrontHeader: any authenticated role can browse the public
  // storefront, so the account menu still has to branch by role, not just show a fixed Buyer menu.
  const menuItems: MenuProps['items'] =
    user?.role === 'SELLER'
      ? [
          { key: 'dashboard', label: <Link to="/seller">{t('common:nav.dashboard')}</Link> },
          { key: 'orders', label: <Link to="/seller/orders">{t('common:nav.orders')}</Link> },
          { type: 'divider' },
          { key: 'logout', label: t('common:actions.logout'), onClick: handleLogout },
        ]
      : user?.role === 'ADMIN'
        ? [
            { key: 'admin', label: <Link to="/admin">{t('common:nav.admin')}</Link> },
            { type: 'divider' },
            { key: 'logout', label: t('common:actions.logout'), onClick: handleLogout },
          ]
        : [
            { key: 'orders', label: <Link to="/orders">{t('common:nav.orders')}</Link> },
            { key: 'profile', label: <Link to="/buyer/profile">{t('common:nav.profile')}</Link> },
            { type: 'divider' },
            { key: 'logout', label: t('common:actions.logout'), onClick: handleLogout },
          ];

  const isGuest = !user;
  const bottomTabs: NavItem[] = [
    { key: 'home', to: '/', label: t('common:nav.home'), icon: Home, exact: true },
    { key: 'search', to: '/search', label: t('common:nav.search'), icon: Search },
    { key: 'cart', to: '/cart', label: t('common:nav.cart'), icon: ShoppingCart, badge: cartCount },
    { key: 'orders', to: isGuest ? '/login' : '/orders', label: t('common:nav.orders'), icon: ClipboardList },
    { key: 'account', to: isGuest ? '/login' : '/buyer/profile', label: t('common:nav.profile'), icon: User },
  ];

  return (
    <AppShell
      header={
        <AppHeader
          homeHref="/"
          brandLabel="KarobarAI"
          search={<SearchBar />}
          actions={
            <Link to="/cart">
              <Badge count={cartCount} size="small" offset={[-4, 4]}>
                <Button>{t('common:nav.cart')}</Button>
              </Badge>
            </Link>
          }
          notificationSlot={user && <NotificationBell />}
          accountSlot={
            user && (
              <Dropdown menu={{ items: menuItems }}>
                <Button>{t('common:nav.profile')}</Button>
              </Dropdown>
            )
          }
          guestActions={
            !user && (
              <Space>
                <Link to="/login">
                  <Button>{t('marketplace:home.loginCta')}</Button>
                </Link>
                <Link to="/register">
                  <Button type="primary">{t('marketplace:home.registerCta')}</Button>
                </Link>
              </Space>
            )
          }
        />
      }
      bottomTabs={<BottomTabBar items={bottomTabs} ariaLabel={t('common:landmarks.buyerNav')} />}
    >
      <Outlet />
    </AppShell>
  );
}
