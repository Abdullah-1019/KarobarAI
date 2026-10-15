import { useEffect, useRef, useState } from 'react';
import { Drawer, Dropdown, Segmented } from 'antd';
import type { MenuProps } from 'antd';
import { ClipboardList, Home, LogOut, Menu, Search, ShoppingCart, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button, Container } from '../../components';
import { useLanguage, useScrolled } from '../../hooks';
import type { AuthUser } from '../../lib/authStore';
import { NotificationBell } from '../notifications';
import { AnnouncementBar } from './AnnouncementBar';
import { SearchBar } from './SearchBar';
import { StorefrontLogo } from './StorefrontLogo';

interface StorefrontHeaderProps {
  user: AuthUser | null;
  cartCount: number;
  onLogout: () => void;
}

// The Buyer storefront navbar (UIUX §10). Bespoke rather than reusing the shared AppHeader
// (components/AppHeader) because it needs behavior AppHeader doesn't have and Seller/Admin don't
// want: a dismissible announcement strip, a sticky bar that shrinks + blurs on scroll, the SVG
// brand lockup, a mobile drawer and a mobile search overlay. Seller/Admin keep AppHeader.
export function StorefrontHeader({ user, cartCount, onLogout }: StorefrontHeaderProps) {
  const { t } = useTranslation(['common', 'marketplace']);
  const { language, dir, setLanguage } = useLanguage();
  const scrolled = useScrolled(8);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartPop, setCartPop] = useState(false);
  const prevCartCount = useRef(cartCount);

  // Cart badge "pop" — only when the count grows (adding an item), not on initial mount.
  useEffect(() => {
    if (cartCount > prevCartCount.current) {
      setCartPop(true);
      const id = setTimeout(() => setCartPop(false), 500);
      prevCartCount.current = cartCount;
      return () => clearTimeout(id);
    }
    prevCartCount.current = cartCount;
  }, [cartCount]);

  const menuItems: MenuProps['items'] =
    user?.role === 'SELLER'
      ? [
          { key: 'dashboard', label: <Link to="/seller">{t('common:nav.dashboard')}</Link> },
          { key: 'orders', label: <Link to="/seller/orders">{t('common:nav.orders')}</Link> },
          { type: 'divider' },
          { key: 'logout', label: t('common:actions.logout'), onClick: onLogout },
        ]
      : user?.role === 'ADMIN'
        ? [
            { key: 'admin', label: <Link to="/admin">{t('common:nav.admin')}</Link> },
            { type: 'divider' },
            { key: 'logout', label: t('common:actions.logout'), onClick: onLogout },
          ]
        : [
            { key: 'orders', label: <Link to="/orders">{t('common:nav.orders')}</Link> },
            { key: 'profile', label: <Link to="/buyer/profile">{t('common:nav.profile')}</Link> },
            { type: 'divider' },
            { key: 'logout', label: t('common:actions.logout'), onClick: onLogout },
          ];

  const cartBadge = cartCount > 9 ? '9+' : cartCount;

  return (
    <div className={`storefront-header${scrolled ? ' is-scrolled' : ''}`}>
      <AnnouncementBar />

      <nav className="storefront-nav" aria-label={t('common:landmarks.buyerNav')}>
        <Container className="storefront-nav__row">
          <button
            type="button"
            className="icon-btn buyer-mobile"
            onClick={() => setMenuOpen(true)}
            aria-label={t('marketplace:nav.openMenu')}
          >
            <Menu size={22} aria-hidden="true" />
          </button>

          <StorefrontLogo />

          <div className="storefront-nav__search buyer-desktop">
            <SearchBar />
          </div>

          <div className="storefront-nav__actions">
            <button
              type="button"
              className="icon-btn buyer-mobile"
              onClick={() => setSearchOpen(true)}
              aria-label={t('marketplace:nav.openSearch')}
            >
              <Search size={22} aria-hidden="true" />
            </button>

            <Segmented
              className="buyer-desktop"
              size="middle"
              value={language}
              onChange={(value) => setLanguage(value as 'EN' | 'UR')}
              options={[
                { label: 'EN', value: 'EN' },
                { label: 'اردو', value: 'UR' },
              ]}
            />

            {user && <NotificationBell />}

            <Link to="/cart" className={`icon-btn cart-btn${cartPop ? ' is-pop' : ''}`} aria-label={t('common:nav.cart')}>
              <ShoppingCart size={22} aria-hidden="true" />
              {cartCount > 0 && <span className="cart-btn__badge">{cartBadge}</span>}
            </Link>

            <span className="buyer-desktop storefront-nav__seller">
              <Button variant="outline-saffron" to="/register?role=seller">
                {t('marketplace:nav.becomeSeller')}
              </Button>
            </span>

            {user ? (
              <span className="buyer-desktop">
                <Dropdown menu={{ items: menuItems }}>
                  <Button variant="ghost" icon={<User size={18} aria-hidden="true" />}>
                    {t('common:nav.profile')}
                  </Button>
                </Dropdown>
              </span>
            ) : (
              <span className="buyer-desktop">
                <Button variant="ghost" to="/login">
                  {t('marketplace:nav.login')}
                </Button>
              </span>
            )}
          </div>
        </Container>
      </nav>

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        placement={dir === 'rtl' ? 'right' : 'left'}
        title={<StorefrontLogo />}
        width={300}
        className="storefront-drawer"
      >
        <nav className="storefront-drawer__nav">
          <Link to="/" className="storefront-drawer__link" onClick={() => setMenuOpen(false)}>
            <Home size={18} aria-hidden="true" />
            {t('common:nav.home')}
          </Link>
          <Link to="/search" className="storefront-drawer__link" onClick={() => setMenuOpen(false)}>
            <Search size={18} aria-hidden="true" />
            {t('common:nav.search')}
          </Link>
          <Link
            to={user ? '/orders' : '/login'}
            className="storefront-drawer__link"
            onClick={() => setMenuOpen(false)}
          >
            <ClipboardList size={18} aria-hidden="true" />
            {t('common:nav.orders')}
          </Link>
          <Link
            to={user ? '/buyer/profile' : '/login'}
            className="storefront-drawer__link"
            onClick={() => setMenuOpen(false)}
          >
            <User size={18} aria-hidden="true" />
            {t('common:nav.profile')}
          </Link>
        </nav>

        <div className="storefront-drawer__section">
          <Segmented
            block
            value={language}
            onChange={(value) => setLanguage(value as 'EN' | 'UR')}
            options={[
              { label: t('common:languageToggle.en'), value: 'EN' },
              { label: t('common:languageToggle.ur'), value: 'UR' },
            ]}
          />
        </div>

        <div className="storefront-drawer__section">
          {user ? (
            <Button
              variant="outline"
              fullWidth
              icon={<LogOut size={18} aria-hidden="true" />}
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
            >
              {t('common:actions.logout')}
            </Button>
          ) : (
            <div onClick={() => setMenuOpen(false)}>
              <Button variant="outline" fullWidth to="/login">
                {t('marketplace:nav.login')}
              </Button>
              <div style={{ marginTop: 'var(--sp-3)' }}>
                <Button variant="cta" fullWidth to="/register?role=seller">
                  {t('marketplace:nav.becomeSeller')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Drawer>

      <Drawer
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        placement="top"
        height="auto"
        closable={false}
        className="storefront-search-drawer"
      >
        <div style={{ paddingTop: 'var(--sp-2)' }}>
          <SearchBar autoFocus rotatePlaceholders onSubmitted={() => setSearchOpen(false)} />
        </div>
      </Drawer>
    </div>
  );
}
