import type { MenuProps } from 'antd';
import { ConfigProvider } from 'antd';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  ClipboardList,
  House,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Undo2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { compactDensity } from '../../app/theme';
import { AiMark, BrandLogo, CountBadge, LanguageToggle } from '../../components';
import { isNavItemActive, type NavItem } from '../../components/navTypes';
import { useLanguage, useMediaQuery } from '../../hooks';
import { useAiUnreadStore } from '../../lib/aiUnreadStore';
import { useAuthStore } from '../../lib/authStore';
import { useUnreadMessages } from '../human-chat/useUnreadMessages';
import { NotificationBell } from '../notifications';
import { AccountMenu } from '../profile';
import { PROFILE_QUERY_KEY, STORE_STATUS_QUERY_KEY, getProfile, getStoreStatus } from '../profile/profileApi';
import { logout as logoutApi } from '../auth/authApi';
import './seller.css';

const COLLAPSE_KEY = 'ka.sellerNavCollapsed';

interface NavGroup {
  key: 'groupStore' | 'groupGrow' | 'groupAccount';
  items: NavItem[];
}

// The Seller workspace shell (Studio Light, calm + trustworthy): a quiet sidebar that is part of
// the page (logo, the one persimmon "Add with AI" action, grouped nav, the store card at the
// bottom), a slim top bar (current section, language, notifications, account), and on phones a
// bottom bar with the AI add button in the middle. Seller-only on purpose — Admin keeps AppShell.
//
// `/seller` is the Seller's home (SellerProductsPage); "Wallet" resolves via the `/seller/*`
// placeholder. While the store isn't set up yet (/seller/setup) the nav is hidden: every link
// would just bounce back to setup.
export function SellerLayout() {
  const { t } = useTranslation(['common', 'profile']);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isWide = useMediaQuery('(min-width: 768px)');
  const clearSession = useAuthStore((s) => s.clearSession);
  const { data: profile } = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: getProfile });
  const store = profile?.role === 'SELLER' && profile.hasStore ? profile : null;
  const settingUp = !store;
  const { data: storeStatus } = useQuery({
    queryKey: STORE_STATUS_QUERY_KEY,
    queryFn: getStoreStatus,
    enabled: !!store,
  });
  const { dir } = useLanguage();
  const unreadMessages = useUnreadMessages();
  const aiUnread = useAiUnreadStore((s) => s.seller);
  // Desktop-only choice to shrink the sidebar to its icon rail; remembered on this device.
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
  // The panel icons point at the sidebar's edge, so they flip with the page direction.
  const CollapseIcon = (collapsed ? dir === 'rtl' : dir !== 'rtl') ? PanelLeftClose : PanelLeftOpen;

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

  const menuItems: MenuProps['items'] = [
    { key: 'profile', label: <Link to="/seller/profile">{t('nav.profile')}</Link> },
    { type: 'divider' },
    { key: 'logout', label: t('actions.logout'), onClick: handleLogout },
  ];

  const item = (key: string, to: string, label: string, icon: LucideIcon, exact = false, badge = 0): NavItem => ({
    key,
    to,
    label,
    icon,
    exact,
    badge,
  });
  const withUnread = (label: string, count: number) => (count > 0 ? t('nav.withUnread', { label, count }) : label);
  const home = item('home', '/seller', t('nav.sellerHome'), House, true);
  const orders = item('orders', '/seller/orders', t('nav.orders'), ClipboardList);
  const returns = item('returns', '/seller/returns', t('nav.returns'), Undo2);
  const messages = item('messages', '/seller/messages', t('nav.messages'), MessageCircle, false, unreadMessages);
  const analytics = item('analytics', '/seller/analytics', t('nav.analytics'), BarChart3);
  const assistant = item('assistant', '/seller/assistant', t('nav.assistant'), Bot, false, aiUnread);
  const wallet = item('wallet', '/seller/wallet', t('nav.wallet'), Wallet);
  const settings = item('settings', '/seller/profile/settings', t('nav.adminConfig'), Settings);

  const groups: NavGroup[] = [
    { key: 'groupStore', items: [home, orders, returns, messages] },
    { key: 'groupGrow', items: [analytics, assistant] },
    { key: 'groupAccount', items: [wallet, settings] },
  ];
  const allItems = groups.flatMap((group) => group.items);
  // Product pages live under Home (the product list is the home page).
  const current =
    allItems.find((navItem) => navItem.key !== 'home' && isNavItemActive(pathname, navItem)) ??
    (pathname.startsWith('/seller/products') || pathname === '/seller' ? home : undefined);
  // Detail pages get a back link to their list in the top bar; top-level pages show the store's
  // real status instead (green "Live" only when the account is ACTIVE).
  const parent = pathname.startsWith('/seller/products/')
    ? home
    : /^\/seller\/(orders|returns)\/.+/.test(pathname)
      ? pathname.startsWith('/seller/orders')
        ? orders
        : returns
      : /^\/seller\/profile\/.+/.test(pathname)
        ? item('profile', '/seller/profile', t('nav.profile'), House)
        : undefined;
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const live = storeStatus?.status === 'ACTIVE';

  const navLink = (navItem: NavItem) => {
    const active = current?.key === navItem.key;
    const Icon = navItem.icon;
    return (
      <Link
        key={navItem.key}
        to={navItem.to}
        className="slNavLink"
        title={collapsed ? navItem.label : undefined}
        aria-label={navItem.badge ? withUnread(navItem.label, navItem.badge) : undefined}
        aria-current={active ? 'page' : undefined}
        data-active={active || undefined}
      >
        <span className="slNavIcon">
          <Icon size={18} aria-hidden="true" />
          <CountBadge count={navItem.badge} />
        </span>
        <span className="slNavLabel">{navItem.label}</span>
      </Link>
    );
  };

  const shell = (
    <div className="slShell" data-setup={settingUp || undefined} data-collapsed={collapsed || undefined}>
      <a href="#main-content" className="skip-link">
        {t('a11y.skipToContent')}
      </a>

      {!settingUp && (
        <aside className="slSide">
          <div className="slSideHead">
            <Link to="/seller" className="slSideBrand" aria-label="KarobarAI">
              <BrandLogo />
            </Link>
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

          <Link to="/seller/products/new" className="slAddAi">
            <AiMark size={14} color="currentColor" />
            <span className="slAddAiLabel">{t('nav.addWithAi')}</span>
          </Link>

          <nav className="slNav" aria-label={t('landmarks.sellerNav')}>
            {groups.map((group) => (
              <div key={group.key} className="slNavGroup">
                <span className="slNavGroupLabel">{t(`nav.${group.key}`)}</span>
                {group.items.map(navLink)}
              </div>
            ))}
          </nav>

          {store && (
            <Link to="/seller/profile" className="slStoreCard">
              <span className="slStoreLogo" aria-hidden="true">
                {store.logoUrl ? <img src={store.logoUrl} alt="" /> : store.storeName.slice(0, 1).toUpperCase()}
              </span>
              <span className="slStoreText">
                <span className="slStoreName">{store.storeName}</span>
                <span className="slStoreCity">{store.city ?? t('nav.viewStore')}</span>
              </span>
            </Link>
          )}
        </aside>
      )}

      <div className="slColumn">
        <header className="slTopbar">
          <Link to="/seller" className="slTopBrand" aria-label="KarobarAI">
            <BrandLogo />
          </Link>
          {settingUp ? (
            <span className="slSection">{t('nav.setupStore')}</span>
          ) : parent ? (
            <Link to={parent.to} className="slBack" aria-label={t('nav.backTo', { label: parent.label })}>
              <BackIcon size={16} aria-hidden="true" />
              <span>{parent.label}</span>
            </Link>
          ) : (
            store && (
              <Link to="/seller/profile" className="slStatus" data-live={live || undefined}>
                <span className="slStatusDot" aria-hidden="true" />
                <span className="slStatusName">{store.storeName}</span>
                {storeStatus && (
                  <span className="slStatusText">
                    {live ? t('nav.storeLive') : t(`profile:status.${storeStatus.status}`)}
                  </span>
                )}
              </Link>
            )
          )}
          <div className="slTopActions">
            {!settingUp && (
              <>
                <Link
                  to="/seller/assistant"
                  className="slIconBtn slIconBtn--ai"
                  aria-label={withUnread(t('nav.assistant'), aiUnread)}
                  title={t('nav.assistant')}
                >
                  <AiMark size={16} color="currentColor" />
                  <CountBadge count={aiUnread} />
                </Link>
                <Link
                  to="/seller/messages"
                  className="slIconBtn"
                  aria-label={withUnread(t('nav.messages'), unreadMessages)}
                  title={t('nav.messages')}
                >
                  <MessageCircle size={18} aria-hidden="true" />
                  <CountBadge count={unreadMessages} />
                </Link>
                <span className="slBell">
                  <NotificationBell />
                </span>
              </>
            )}
            <LanguageToggle />
            <span className="slTopDivider" aria-hidden="true" />
            <AccountMenu items={menuItems} />
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="slMain">
          <Outlet />
        </main>
      </div>

      {!settingUp && (
        <nav className="slTabs" aria-label={t('landmarks.sellerNav')}>
          {[home, orders].map(navLink)}
          <Link to="/seller/products/new" className="slTabAdd" aria-label={t('nav.addWithAi')}>
            <span className="slTabAddBtn">
              <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span className="slNavLabel">{t('nav.addShort')}</span>
          </Link>
          {[returns, messages].map(navLink)}
        </nav>
      )}
    </div>
  );

  // Compact (40px) AntD controls on tablet/desktop; phones keep the 48px touch default.
  return isWide ? <ConfigProvider theme={compactDensity}>{shell}</ConfigProvider> : shell;
}
