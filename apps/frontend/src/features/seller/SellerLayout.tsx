import { Button, Dropdown, Layout, Segmented, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useNavigate } from 'react-router-dom';

import { useLanguage } from '../../hooks';
import { useAuthStore } from '../../lib/authStore';
import { NotificationBell } from '../notifications';
import { logout as logoutApi } from '../auth/authApi';

// New — every /seller/* page previously rendered with zero persistent header/nav at all (no
// layout wrapped that route branch, unlike StorefrontLayout for Buyer routes). Added now because
// Feature 9's bell icon needs somewhere for a Seller to actually see it while working their own
// pages, not just when they happen to browse the public storefront. Deliberately minimal — no
// search bar/cart badge (not relevant to a Seller), mirrors StorefrontHeader.tsx's existing
// Seller menu-items branch and logout() call.
export function SellerLayout() {
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
        <Link to="/seller">
          <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', color: 'inherit' }}>
            KarobarAI
          </Typography.Title>
        </Link>

        <Space style={{ flex: 1 }}>
          <Link to="/seller">
            <Button type="text">{t('nav.dashboard')}</Button>
          </Link>
          <Link to="/seller/orders">
            <Button type="text">{t('nav.orders')}</Button>
          </Link>
        </Space>

        <Segmented
          size="small"
          value={language}
          onChange={(value) => setLanguage(value as 'EN' | 'UR')}
          options={[
            { label: 'EN', value: 'EN' },
            { label: 'اردو', value: 'UR' },
          ]}
        />

        <NotificationBell />

        <Dropdown menu={{ items: menuItems }}>
          <Button>{t('nav.profile')}</Button>
        </Dropdown>
      </Layout.Header>
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
    </div>
  );
}
