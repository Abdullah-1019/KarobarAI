import { ClipboardList, Home, Search, ShoppingCart, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';

import { AppShell, BottomTabBar, type NavItem } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { logout as logoutApi } from '../auth/authApi';
import { useCartCount } from '../cart/useCartCount';
import { useGuestCartMerge } from '../cart/useGuestCartMerge';
import { StorefrontHeader } from './StorefrontHeader';
import { StorefrontFooter } from './StorefrontFooter';

// Route-layout element wrapping every storefront-facing route (home, search, product detail,
// cart, and the buyer-protected checkout/orders group) — see app/router.tsx. The Buyer "chrome"
// is now the bespoke StorefrontHeader (announcement bar + sticky shrinking nav + mobile drawer);
// AppShell/BottomTabBar stay shared. The account menu, guest CTAs and cart badge that used to be
// passed into the shared AppHeader now live inside StorefrontHeader, so this layout just wires
// session + cart + logout into it.
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
      header={<StorefrontHeader user={user} cartCount={cartCount} onLogout={handleLogout} />}
      footer={<StorefrontFooter />}
      bottomTabs={<BottomTabBar items={bottomTabs} ariaLabel={t('common:landmarks.buyerNav')} />}
    >
      <Outlet />
    </AppShell>
  );
}
