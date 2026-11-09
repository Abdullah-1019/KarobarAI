import { useEffect, useRef, useState } from 'react';
import { Drawer } from 'antd';
import type { MenuProps } from 'antd';
import { ClipboardList, Home, LogOut, Menu, MessageCircle, Search, ShoppingBag, Store, Undo2, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { AiMark, Button, Container, CountBadge, LanguageToggle } from '../../components';
import { useLanguage, useScrolled } from '../../hooks';
import { useAiUnreadStore } from '../../lib/aiUnreadStore';
import type { AuthUser } from '../../lib/authStore';
import { useStoreChatStore } from '../../lib/storeChatStore';
import { useUnreadMessages } from '../human-chat/useUnreadMessages';
import { NotificationBell, useUnreadSummary } from '../notifications';
import { AccountMenu, GuestAccountLink } from '../profile';
import { AnnouncementBar } from './AnnouncementBar';
import { CategoriesMenu } from './CategoriesMenu';
import { SearchBar } from './SearchBar';
import { StorefrontLogo } from './StorefrontLogo';

interface StorefrontHeaderProps {
  user: AuthUser | null;
  cartCount: number;
  onLogout: () => void;
}

// One glass pill behind the nav tabs: it appears under the hovered (or focused) tab and glides from
// tab to tab, then fades when the pointer leaves the row.
function useNavHoverPill() {
  const navLinksRef = useRef<HTMLDivElement>(null);
  const navPillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const row = navLinksRef.current;
    const pill = navPillRef.current;
    if (!row || !pill) return undefined;
    row.dataset.pill = 'true';
    let shown = false;

    const moveTo = (target: EventTarget | null) => {
      const tab = (target as Element | null)?.closest?.('.storefront-nav__link');
      if (!tab || !row.contains(tab)) return;
      const from = row.getBoundingClientRect();
      const box = tab.getBoundingClientRect();
      if (!shown) {
        // the first tab touched: appear in place instead of gliding in from the old spot
        pill.style.transition = 'none';
        pill.style.width = `${box.width}px`;
        pill.style.transform = `translate3d(${box.left - from.left}px, 0, 0)`;
        void pill.offsetWidth;
        pill.style.transition = '';
      }
      pill.style.width = `${box.width}px`;
      pill.style.transform = `translate3d(${box.left - from.left}px, 0, 0)`;
      pill.dataset.on = 'true';
      shown = true;
    };
    const hide = () => {
      delete pill.dataset.on;
      shown = false;
    };
    const onOver = (event: PointerEvent) => moveTo(event.target);
    const onFocus = (event: FocusEvent) => moveTo(event.target);
    const onBlur = (event: FocusEvent) => {
      if (!row.contains(event.relatedTarget as Node | null)) hide();
    };

    row.addEventListener('pointerover', onOver);
    row.addEventListener('pointerleave', hide);
    row.addEventListener('focusin', onFocus);
    row.addEventListener('focusout', onBlur);
    return () => {
      row.removeEventListener('pointerover', onOver);
      row.removeEventListener('pointerleave', hide);
      row.removeEventListener('focusin', onFocus);
      row.removeEventListener('focusout', onBlur);
    };
  }, []);

  return { navLinksRef, navPillRef };
}

// The Buyer storefront navbar — Studio Light's floating pill nav (DESIGN-CONSULT §7; the sample
// Home design). An ink announcement strip scrolls away above a sticky white pill holding the logo,
// Shop / Sell links, search, the EN/اردو toggle, a round cart button and an ink "Log in" pill.
// After 24px of scroll the pill turns more opaque and its shadow deepens. Bespoke rather than the
// shared AppHeader (Seller/Admin keep that): it also owns the mobile drawer and search overlay.
export function StorefrontHeader({ user, cartCount, onLogout }: StorefrontHeaderProps) {
  const { t } = useTranslation(['common', 'marketplace']);
  const { dir } = useLanguage();
  const scrolled = useScrolled(24);
  const { pathname } = useLocation();
  // Over the Home hero the navbar shows only a search icon (the hero leads with its calls to
  // action); the icon expands the search pill in place. Past the hero, and on every other page,
  // the pill shows as usual.
  const pastHeroSearch = useScrolled(560);
  const onHero = pathname === '/' && !pastHeroSearch;
  const [heroSearchOpen, setHeroSearchOpen] = useState(false);
  const heroOwnsSearch = onHero && !heroSearchOpen;
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const { navLinksRef, navPillRef } = useNavHoverPill();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartPop, setCartPop] = useState(false);
  const prevCartCount = useRef(cartCount);
  const isBuyer = user?.role === 'BUYER';
  const unreadMessages = useUnreadMessages();
  const messagesLabel =
    unreadMessages > 0 ? t('common:nav.withUnread', { label: t('common:nav.messages'), count: unreadMessages }) : t('common:nav.messages');
  // Order / return updates get their own counts on the links that lead to them.
  const unread = useUnreadSummary();
  const ordersUnread = unread?.orders.count ?? 0;
  const returnsUnread = unread?.returns.count ?? 0;
  const withCount = (label: string, count: number) => (count > 0 ? t('common:nav.withUnread', { label, count }) : label);
  const countPill = (count: number, className: string) =>
    count > 0 ? <span className={className}>{count > 9 ? '9+' : count}</span> : null;
  const menuHasNew = (isBuyer && unreadMessages > 0) || ordersUnread > 0 || returnsUnread > 0;

  // Leaving the hero (or the page) folds the expanded search back into the normal behaviour.
  useEffect(() => {
    if (!onHero) setHeroSearchOpen(false);
  }, [onHero]);

  const openSearch = () => {
    // Wide screens expand the pill inside the navbar; narrower ones keep the search sheet.
    if (onHero && window.matchMedia('(min-width: 1100px)').matches) setHeroSearchOpen(true);
    else setSearchOpen(true);
  };
  const closeHeroSearch = () => setHeroSearchOpen(false);

  // Cart badge "pop" — only when the count grows (adding an item), not on initial mount.
  useEffect(() => {
    if (cartCount > prevCartCount.current) {
      setCartPop(true);
      const id = setTimeout(() => setCartPop(false), 400);
      prevCartCount.current = cartCount;
      return () => clearTimeout(id);
    }
    prevCartCount.current = cartCount;
  }, [cartCount]);

  const menuItems: MenuProps['items'] =
    user?.role === 'SELLER'
      ? [
          { key: 'dashboard', label: <Link to="/seller">{t('common:nav.dashboard')}</Link> },
          {
            key: 'orders',
            label: (
              <Link to="/seller/orders" className="account-menu__count-link" aria-label={withCount(t('common:nav.orders'), ordersUnread)}>
                {t('common:nav.orders')}
                {countPill(ordersUnread, 'account-menu__count')}
              </Link>
            ),
          },
          {
            key: 'returns',
            label: (
              <Link to="/seller/returns" className="account-menu__count-link" aria-label={withCount(t('common:nav.returns'), returnsUnread)}>
                {t('common:nav.returns')}
                {countPill(returnsUnread, 'account-menu__count')}
              </Link>
            ),
          },
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
            {
              key: 'orders',
              label: (
                <Link to="/orders" className="account-menu__count-link" aria-label={withCount(t('common:nav.orders'), ordersUnread)}>
                  {t('common:nav.orders')}
                  {countPill(ordersUnread, 'account-menu__count')}
                </Link>
              ),
            },
            {
              key: 'returns',
              label: (
                <Link to="/returns" className="account-menu__count-link" aria-label={withCount(t('common:nav.myReturns'), returnsUnread)}>
                  {t('common:nav.myReturns')}
                  {countPill(returnsUnread, 'account-menu__count')}
                </Link>
              ),
            },
            {
              key: 'messages',
              label: (
                <Link to="/messages" className="account-menu__count-link" aria-label={messagesLabel}>
                  {t('common:nav.messages')}
                  {unreadMessages > 0 && <span className="account-menu__count">{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
                </Link>
              ),
            },
            { key: 'profile', label: <Link to="/buyer/profile">{t('common:nav.profile')}</Link> },
            { type: 'divider' },
            { key: 'logout', label: t('common:actions.logout'), onClick: onLogout },
          ];

  const cartBadge = cartCount > 9 ? '9+' : cartCount;
  const storeChat = useStoreChatStore((s) => s.active);
  const requestStoreChat = useStoreChatStore((s) => s.requestOpen);
  const aiUnread = useAiUnreadStore((s) => (storeChat ? s.buyer[storeChat.slug] ?? 0 : 0));
  const aiLabel = storeChat ? t('common:nav.askStoreAi', { store: storeChat.name }) : t('common:nav.aiPickStore');

  return (
    <div className={`storefront-header${scrolled ? ' is-scrolled' : ''}`}>
      <AnnouncementBar />

      <nav className="storefront-nav" aria-label={t('common:landmarks.buyerNav')}>
        <Container className="storefront-nav__shell">
          <div className="storefront-nav__row">
            <button
              type="button"
              className="icon-btn buyer-mobile"
              onClick={() => setMenuOpen(true)}
              aria-label={t('marketplace:nav.openMenu')}
            >
              <Menu size={20} aria-hidden="true" />
              {user && <CountBadge dot={menuHasNew} />}
            </button>

            <StorefrontLogo />

            <div className="storefront-nav__links buyer-desktop" ref={navLinksRef}>
              <span className="storefront-nav__pill" ref={navPillRef} aria-hidden="true" />
              <NavLink to="/search" className="storefront-nav__link">
                {t('marketplace:nav.shop')}
              </NavLink>
              <CategoriesMenu />
              <NavLink to="/stores" className="storefront-nav__link">
                {t('common:nav.stores')}
              </NavLink>
              <NavLink to="/sell" className="storefront-nav__link">
                {t('marketplace:nav.sell')}
              </NavLink>
            </div>

            <div
              ref={searchWrapRef}
              className={`storefront-nav__search${heroOwnsSearch ? ' is-deferred' : ''}${onHero && heroSearchOpen ? ' is-expanded' : ''}`}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && onHero) closeHeroSearch();
              }}
              onBlur={(event) => {
                // Fold back once focus leaves the expanded pill (its suggestion list keeps focus).
                if (!onHero || !heroSearchOpen) return;
                const next = event.relatedTarget as Node | null;
                if (!next || !searchWrapRef.current?.contains(next)) window.setTimeout(closeHeroSearch, 120);
              }}
            >
              <SearchBar
                key={heroSearchOpen ? 'expanded' : 'resting'}
                autoFocus={onHero && heroSearchOpen}
                onSubmitted={onHero ? closeHeroSearch : undefined}
              />
            </div>

            <div className="storefront-nav__actions">
              <button
                type="button"
                className={`icon-btn storefront-nav__search-btn${onHero ? ' is-hero' : ''}${onHero && heroSearchOpen ? ' is-deferred' : ''}`}
                onClick={openSearch}
                aria-label={t('marketplace:nav.openSearch')}
                aria-expanded={onHero ? heroSearchOpen : undefined}
              >
                <Search size={20} aria-hidden="true" />
              </button>

              <LanguageToggle className="buyer-desktop" />

              {user && <NotificationBell />}

              {isBuyer && (
                <Link to="/messages" className="icon-btn buyer-desktop" aria-label={messagesLabel} title={t('common:nav.messages')}>
                  <MessageCircle size={20} aria-hidden="true" />
                  <CountBadge count={unreadMessages} />
                </Link>
              )}

              {/* AI store assistant: opens the chat of the store being viewed, otherwise leads to the
                  store directory (each store has its own assistant). */}
              {storeChat ? (
                <button
                  type="button"
                  className="icon-btn storefront-nav__ai buyer-desktop"
                  onClick={requestStoreChat}
                  aria-label={aiUnread > 0 ? t('common:nav.withUnread', { label: aiLabel, count: aiUnread }) : aiLabel}
                  title={aiLabel}
                >
                  <AiMark size={18} color="var(--ai-accent)" />
                  <CountBadge count={aiUnread} />
                </button>
              ) : (
                <Link to="/stores" className="icon-btn storefront-nav__ai buyer-desktop" aria-label={aiLabel} title={aiLabel}>
                  <AiMark size={18} color="var(--ai-accent)" />
                </Link>
              )}

              <Link to="/cart" className={`icon-btn cart-btn${cartPop ? ' is-pop' : ''}`} aria-label={t('common:nav.cart')}>
                <ShoppingBag size={20} strokeWidth={1.9} aria-hidden="true" />
                {cartCount > 0 && <span className="cart-btn__badge">{cartBadge}</span>}
              </Link>

              {/* Account: an ink "Log in" pill for guests (a round glyph on phones), the avatar menu
                  once signed in. */}
              {user ? <AccountMenu items={menuItems} hasNew={menuHasNew} /> : <GuestAccountLink label={t('marketplace:nav.login')} />}
            </div>
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
          <Link to="/stores" className="storefront-drawer__link" onClick={() => setMenuOpen(false)}>
            <Store size={18} aria-hidden="true" />
            {t('common:nav.stores')}
          </Link>
          {storeChat ? (
            <button
              type="button"
              className="storefront-drawer__link storefront-drawer__link--button"
              onClick={() => { setMenuOpen(false); requestStoreChat(); }}
            >
              <AiMark size={18} color="var(--ai-accent)" />
              {aiLabel}
              {aiUnread > 0 && <span className="storefront-drawer__count">{aiUnread > 9 ? '9+' : aiUnread}</span>}
            </button>
          ) : (
            <Link to="/stores" className="storefront-drawer__link" onClick={() => setMenuOpen(false)}>
              <AiMark size={18} color="var(--ai-accent)" />
              {t('common:nav.aiAssistant')}
            </Link>
          )}
          <Link to="/sell" className="storefront-drawer__link" onClick={() => setMenuOpen(false)}>
            <Store size={18} aria-hidden="true" />
            {t('marketplace:nav.sell')}
          </Link>
          {user?.role === 'SELLER' ? (
            <Link to="/seller" className="storefront-drawer__link" onClick={() => setMenuOpen(false)}>
              <User size={18} aria-hidden="true" />
              {t('common:nav.dashboard')}
              {countPill(ordersUnread + returnsUnread, 'storefront-drawer__count')}
            </Link>
          ) : user?.role === 'ADMIN' ? (
            <Link to="/admin" className="storefront-drawer__link" onClick={() => setMenuOpen(false)}>
              <User size={18} aria-hidden="true" />
              {t('common:nav.admin')}
            </Link>
          ) : (
            <>
              <Link
                to={user ? '/orders' : '/login'}
                className="storefront-drawer__link"
                aria-label={withCount(t('common:nav.orders'), ordersUnread)}
                onClick={() => setMenuOpen(false)}
              >
                <ClipboardList size={18} aria-hidden="true" />
                {t('common:nav.orders')}
                {countPill(ordersUnread, 'storefront-drawer__count')}
              </Link>
              {user && (
                <Link
                  to="/returns"
                  className="storefront-drawer__link"
                  aria-label={withCount(t('common:nav.myReturns'), returnsUnread)}
                  onClick={() => setMenuOpen(false)}
                >
                  <Undo2 size={18} aria-hidden="true" />
                  {t('common:nav.myReturns')}
                  {countPill(returnsUnread, 'storefront-drawer__count')}
                </Link>
              )}
              {isBuyer && (
                <Link to="/messages" className="storefront-drawer__link" aria-label={messagesLabel} onClick={() => setMenuOpen(false)}>
                  <MessageCircle size={18} aria-hidden="true" />
                  {t('common:nav.messages')}
                  {unreadMessages > 0 && <span className="storefront-drawer__count">{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
                </Link>
              )}
              <Link to={user ? '/buyer/profile' : '/login'} className="storefront-drawer__link" onClick={() => setMenuOpen(false)}>
                <User size={18} aria-hidden="true" />
                {t('common:nav.profile')}
              </Link>
            </>
          )}
        </nav>

        <div className="storefront-drawer__section">
          <LanguageToggle />
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
                <Button variant="cta" fullWidth to="/sell">
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
