import type { MenuProps } from 'antd';
import { ConfigProvider } from 'antd';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { compactDensity } from '../../app/theme';
import { BrandLogo, LanguageToggle } from '../../components';
import { isNavItemActive, type NavItem } from '../../components/navTypes';
import { useLanguage, useMediaQuery } from '../../hooks';
import { useAuthStore } from '../../lib/authStore';
import { NotificationBell } from '../notifications';
import { AccountMenu } from '../profile';
import { logout as logoutApi } from '../auth/authApi';
import '../seller/seller.css';
import './admin.css';

const COLLAPSE_KEY = 'ka.adminNavCollapsed';

interface NavGroup {
  key: 'groupMonitor' | 'groupReview' | 'groupManage';
  items: NavItem[];
}

// Every /admin/* page renders through this layout. It shares the Seller workspace's shell
// (seller.css: floating glass sidebar, centred glass top pill, phone tab bar) so the two staff
// sides feel like one product, but reads as a control room: cool washes instead of lilac/peach,
// an ink active pill, no persimmon call-to-action, and compact AntD density on tablet/desktop.
// Support sees the same nav as Admin (every /admin/* read endpoint is Admin+Support); pages gate
// their own write actions off `user.role === 'ADMIN'`, and the sidebar's role card says which.
//
// "Payments" and "Audit" stay out of the nav (E7): no screen exists for them, and a nav item that
// always dead-ends reads as broken. "Returns" is the disputes queue (UNDER_DISPUTE lives there).
export function AdminLayout() {
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isWide = useMediaQuery('(min-width: 768px)');
  const { dir } = useLanguage();
  const clearSession = useAuthStore((s) => s.clearSession);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () => {
    setCollapsed((current) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, current ? '0' : '1');
      } catch {
        /* per-device convenience only */
      }
      return !current;
    });
  };
  const CollapseIcon = (collapsed ? dir === 'rtl' : dir !== 'rtl') ? PanelLeftClose : PanelLeftOpen;
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  async function handleLogout() {
    try {
      await logoutApi();
    } catch {
      // The local session is cleared regardless — a failed revoke call shouldn't trap the user.
    } finally {
      clearSession();
      navigate('/login');
    }
  }

  // No /admin/profile screen exists for Admin/Support roles — the account menu only logs out.
  const menuItems: MenuProps['items'] = [{ key: 'logout', label: t('actions.logout'), onClick: handleLogout }];

  const overview: NavItem = { key: 'overview', to: '/admin', label: t('nav.dashboard'), icon: LayoutDashboard, exact: true };
  const reports: NavItem = { key: 'reports', to: '/admin/reports', label: t('nav.adminReports'), icon: TrendingUp };
  const returns: NavItem = { key: 'returns', to: '/admin/returns', label: t('nav.returns'), icon: Scale };
  const moderation: NavItem = { key: 'moderation', to: '/admin/moderation', label: t('nav.adminModeration'), icon: ShieldCheck };
  const users: NavItem = { key: 'users', to: '/admin/users', label: t('nav.adminUsers'), icon: Users };
  const config: NavItem = { key: 'config', to: '/admin/config', label: t('nav.adminConfig'), icon: Settings };

  const groups: NavGroup[] = [
    { key: 'groupMonitor', items: [overview, reports] },
    { key: 'groupReview', items: [returns, moderation] },
    { key: 'groupManage', items: [users, config] },
  ];
  const allItems = groups.flatMap((group) => group.items);
  const current = allItems.find((item) => isNavItemActive(pathname, item));
  // Detail pages get a back link to their list in the top pill; list pages show their name.
  const parent = /^\/admin\/returns\/.+/.test(pathname) ? returns : undefined;

  const navLink = (item: NavItem) => {
    const active = current?.key === item.key;
    const Icon = item.icon;
    return (
      <Link
        key={item.key}
        to={item.to}
        className="slNavLink"
        title={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        data-active={active || undefined}
      >
        <span className="slNavIcon">
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="slNavLabel">{item.label}</span>
      </Link>
    );
  };

  const shell = (
    <div className="slShell adShell" data-collapsed={collapsed || undefined}>
      <a href="#main-content" className="skip-link">
        {t('a11y.skipToContent')}
      </a>

      <aside className="slSide">
        <div className="slSideHead">
          <span className="slSideBrand">
            <BrandLogo to="/admin" />
          </span>
          <button
            type="button"
            className="slCollapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? t('nav.expandNav') : t('nav.collapseNav')}
            aria-expanded={!collapsed}
            title={collapsed ? t('nav.expandNav') : t('nav.collapseNav')}
          >
            <CollapseIcon size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className="slNav" aria-label={t('landmarks.adminNav')}>
          {groups.map((group) => (
            <div key={group.key} className="slNavGroup">
              <span className="slNavGroupLabel">{t(`nav.${group.key}`)}</span>
              {group.items.map(navLink)}
            </div>
          ))}
        </nav>

        <div className="slStoreCard adRoleCard" title={collapsed ? t(isAdmin ? 'nav.adminConsole' : 'nav.supportConsole') : undefined}>
          <span className="slStoreLogo adRoleMark" aria-hidden="true">
            {isAdmin ? <ShieldCheck size={20} /> : <Eye size={20} />}
          </span>
          <span className="slStoreText">
            <span className="slStoreName">{t(isAdmin ? 'nav.adminConsole' : 'nav.supportConsole')}</span>
            <span className="slStoreCity">{t(isAdmin ? 'nav.fullAccess' : 'nav.readOnlyShort')}</span>
          </span>
        </div>
      </aside>

      <div className="slColumn">
        <header className="slTopbar">
          <span className="slTopBrand">
            <BrandLogo to="/admin" />
          </span>
          {parent ? (
            <Link to={parent.to} className="slBack" aria-label={t('nav.backTo', { label: parent.label })}>
              <BackIcon size={16} aria-hidden="true" />
              <span>{parent.label}</span>
            </Link>
          ) : (
            <span className="slSection">{current?.label ?? t('nav.adminConsole')}</span>
          )}
          <div className="slTopActions">
            <span className="adRoleChip" data-admin={isAdmin || undefined}>
              {t(isAdmin ? 'nav.admin' : 'nav.readOnlyShort')}
            </span>
            <span className="slBell">
              <NotificationBell />
            </span>
            <LanguageToggle />
            <span className="slTopDivider" aria-hidden="true" />
            <AccountMenu items={menuItems} />
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="slMain adMain">
          <Outlet />
        </main>
      </div>

      <nav className="slTabs adTabs" aria-label={t('landmarks.adminNav')}>
        {[overview, users, returns, moderation, config].map(navLink)}
      </nav>
    </div>
  );

  // Compact (40px) AntD controls on tablet/desktop; phones keep the 48px touch default.
  return isWide ? <ConfigProvider theme={compactDensity}>{shell}</ConfigProvider> : shell;
}
