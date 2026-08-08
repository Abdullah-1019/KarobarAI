import { Badge, Button, Dropdown, Layout, Segmented, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { useLanguage } from '../../hooks';
import { useAuthStore } from '../../lib/authStore';
import { logout as logoutApi } from '../auth/authApi';
import { useCartCount } from '../cart/useCartCount';
import { NotificationBell } from '../notifications';
import { SearchBar } from './SearchBar';

// New — nothing like this exists in the repo today (AppProviders.tsx renders <RouterProvider>
// with no shell). Storefront-only chrome, not shared with /seller or /admin.
export function StorefrontHeader() {
  const { t } = useTranslation(['common', 'marketplace']);
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
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

  return (
    <Layout.Header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 24px',
        background: 'var(--bg-primary, #fff)',
        borderBottom: '1px solid var(--border-color, #f0f0f0)',
        height: 64,
      }}
    >
      <Link to="/">
        <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', color: 'inherit' }}>
          KarobarAI
        </Typography.Title>
      </Link>

      <div style={{ flex: 1, minWidth: 160 }}>
        <SearchBar />
      </div>

      <Segmented
        size="small"
        value={language}
        onChange={(value) => setLanguage(value as 'EN' | 'UR')}
        options={[
          { label: 'EN', value: 'EN' },
          { label: 'اردو', value: 'UR' },
        ]}
      />

      <Link to="/cart">
        <Badge count={cartCount} size="small" offset={[-4, 4]}>
          <Button>{t('common:nav.cart')}</Button>
        </Badge>
      </Link>

      {user ? (
        <>
          <NotificationBell />
          <Dropdown menu={{ items: menuItems }}>
            <Button>{t('common:nav.profile')}</Button>
          </Dropdown>
        </>
      ) : (
        <Space>
          <Link to="/login">
            <Button>{t('marketplace:home.loginCta')}</Button>
          </Link>
          <Link to="/register">
            <Button type="primary">{t('marketplace:home.registerCta')}</Button>
          </Link>
        </Space>
      )}
    </Layout.Header>
  );
}
