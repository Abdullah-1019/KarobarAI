import { Button, Dropdown, Layout, Segmented, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useNavigate } from 'react-router-dom';

import { useLanguage } from '../../hooks';
import { useAuthStore } from '../../lib/authStore';
import { NotificationBell } from '../notifications';
import { logout as logoutApi } from '../auth/authApi';

// Every /admin/* page previously rendered with no persistent header/nav at all (same gap
// SellerLayout.tsx closed for /seller/* in Feature 9's session). Mirrors SellerLayout.tsx's shape
// — same header chrome, language toggle, notification bell, logout — swapped for the Admin
// Console's own nav items. Support sees the same nav (every admin read endpoint is Admin+Support);
// individual pages gate their own write actions off `user.role === 'ADMIN'`, not this layout.
export function AdminLayout() {
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

  const menuItems: MenuProps['items'] = [{ key: 'logout', label: t('actions.logout'), onClick: handleLogout }];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 24px',
          background: 'var(--bg-surface, #fff)',
          borderBottom: '1px solid var(--border, #f0f0f0)',
          height: 64,
        }}
      >
        <Link to="/admin">
          <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', color: 'inherit' }}>
            KarobarAI Admin
          </Typography.Title>
        </Link>

        <Space style={{ flex: 1 }} wrap>
          <Link to="/admin">
            <Button type="text">{t('nav.dashboard')}</Button>
          </Link>
          <Link to="/admin/users">
            <Button type="text">{t('nav.adminUsers')}</Button>
          </Link>
          <Link to="/admin/moderation">
            <Button type="text">{t('nav.adminModeration')}</Button>
          </Link>
          <Link to="/admin/reports">
            <Button type="text">{t('nav.adminReports')}</Button>
          </Link>
          <Link to="/admin/returns">
            <Button type="text">{t('nav.returns')}</Button>
          </Link>
          <Link to="/admin/config">
            <Button type="text">{t('nav.adminConfig')}</Button>
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

        {/* No /admin/profile screen exists for Admin/Support roles — this trigger only opens Logout. */}
        <Dropdown menu={{ items: menuItems }}>
          <Button>{t('nav.admin')}</Button>
        </Dropdown>
      </Layout.Header>
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
    </div>
  );
}
