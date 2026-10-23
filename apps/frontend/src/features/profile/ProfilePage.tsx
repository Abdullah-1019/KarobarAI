import { useEffect, useState } from 'react';
import { Alert, Button, Input } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays, ChevronRight, Globe, KeyRound, Languages, LayoutGrid, MapPin, MessageCircle, Package,
  RotateCcw, Settings, ShieldCheck, Store, UserRound, type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import type { BuyerProfileDTO, ProfileDTO, SellerProfileDTO } from '@karobarai/shared';
import { SkeletonLoader } from '../../components';
import { useLanguage } from '../../hooks';
import { customerAnalyticsQueryKey, getCustomerAnalytics, getOrderAnalytics, orderAnalyticsQueryKey } from '../analytics/analyticsApi';
import { listSellerProducts, sellerProductsQueryKey } from '../catalog/catalogApi';
import { buyerOrdersQueryKey, listBuyerOrders } from '../orders/ordersApi';
import { buyerReturnsQueryKey, listBuyerReturns } from '../returns/returnsApi';
import { AvatarUpload } from './AvatarUpload';
import { ProfileHero, type ProfileStat } from './ProfileHero';
import { UnderlineTabs } from './UnderlineTabs';
import {
  PROFILE_QUERY_KEY, STORE_STATUS_QUERY_KEY, getProfile, getStoreStatus, updateBuyerDisplayName, uploadAvatar,
  uploadStoreBanner, uploadStoreLogo,
} from './profileApi';
import { formatProfileError } from './profileErrors';
import './profile.css';

// NOT roleHomePath() — that returns the role's storefront/dashboard home ('/' for Buyer), not
// the '/buyer'|'/seller' prefix these nested profile routes actually live under (router.tsx).
// Reusing roleHomePath() here previously built `${'/'}/profile/settings` = '//profile/settings'
// for Buyer — a protocol-relative URL the browser resolves as host "profile", causing
// DNS_PROBE_FINISHED_NXDOMAIN on click (it only "worked" for Seller by coincidence, since
// roleHomePath('SELLER') happens to equal '/seller').
function profileBasePath(role: 'BUYER' | 'SELLER'): string {
  return role === 'SELLER' ? '/seller' : '/buyer';
}

// First page of a cursor list: an exact count, or "20+" when more pages exist (no count endpoint).
function pageCount(page: { items: unknown[]; nextCursor: string | null } | undefined): string | null {
  if (!page) return null;
  return `${page.items.length}${page.nextCursor ? '+' : ''}`;
}

function joinedDate(createdAt: string, language: string): string {
  return new Date(createdAt).toLocaleDateString(language === 'UR' ? 'ur-PK' : 'en-GB', { month: 'long', year: 'numeric' });
}

// App Flow SCR-B12 (Buyer)/SCR-S10 (Seller) profile views. GET /me discriminates on `role` —
// F2-profiles-backend.md: one contract, three shapes, no per-role endpoint. Sellers get a store
// profile (banner, logo, live stats, About/Account/Security tabs); buyers a personal one (avatar,
// name, their orders and returns); Admin/Support, who have no profile route, a plain header.
export function ProfilePage() {
  const { t } = useTranslation(['profile', 'common']);
  const { data: profile, isPending, isError, error, refetch } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: getProfile,
  });

  if (isPending) {
    return (
      <div className="pfPage">
        <div className="pfHero">
          <div className="pfCover pfSkeleton" />
        </div>
        <SkeletonLoader avatar rows={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="pfPage">
        <Alert type="error" showIcon message={formatProfileError(t, error)}
          action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>} />
      </div>
    );
  }

  if (profile.role === 'SELLER') return <SellerProfile profile={profile} />;
  if (profile.role === 'BUYER') return <BuyerProfile profile={profile} />;
  return <StaffProfile profile={profile} />;
}

function useCacheProfile() {
  const queryClient = useQueryClient();
  return (updated: ProfileDTO) => queryClient.setQueryData(PROFILE_QUERY_KEY, updated);
}

/* ── Seller ──────────────────────────────────────────────────────────────────────────────── */

type SellerTab = 'about' | 'account' | 'security';

function SellerProfile({ profile }: { profile: SellerProfileDTO }) {
  const { t } = useTranslation(['profile', 'common']);
  const { language } = useLanguage();
  const navigate = useNavigate();
  const cacheProfile = useCacheProfile();
  const [tab, setTab] = useState<SellerTab>('about');

  const products = useQuery({ queryKey: [...sellerProductsQueryKey('LIVE'), 'profile'], queryFn: () => listSellerProducts('LIVE') });
  const orders = useQuery({ queryKey: orderAnalyticsQueryKey({ range: '3m' }), queryFn: () => getOrderAnalytics({ range: '3m' }) });
  const buyers = useQuery({ queryKey: customerAnalyticsQueryKey({ range: '3m' }), queryFn: () => getCustomerAnalytics({ range: '3m' }) });
  const { data: storeStatus } = useQuery({ queryKey: STORE_STATUS_QUERY_KEY, queryFn: getStoreStatus });

  const live = profile.status === 'ACTIVE';
  const category = profile.storeCategory ? (language === 'UR' ? profile.storeCategory.nameUr : profile.storeCategory.nameEn) : null;
  const stats: ProfileStat[] = [
    { key: 'products', value: products.isError ? '—' : pageCount(products.data), label: t('profile:page.statProducts') },
    { key: 'orders', value: orders.isError ? '—' : orders.data ? String(orders.data.totalOrders) : null, label: t('profile:page.statOrders') },
    { key: 'buyers', value: buyers.isError ? '—' : buyers.data ? String(buyers.data.uniqueBuyers) : null, label: t('profile:page.statBuyers') },
  ];

  return (
    <div className="pfPage">
      <ProfileHero
        coverUrl={profile.bannerUrl}
        mediaUrl={profile.logoUrl}
        mediaShape="square"
        initial={profile.storeName.trim().charAt(0).toUpperCase() || 'K'}
        mediaLabel={t('profile:page.changeLogo')}
        onMediaUpload={uploadStoreLogo}
        onCoverUpload={uploadStoreBanner}
        onUpdated={cacheProfile}
        name={profile.storeName}
        badge={live ? <span className="pfLive"><span aria-hidden="true" />{t('profile:page.live')}</span> : null}
        meta={
          <>
            {category && <span><LayoutGrid size={14} aria-hidden="true" />{category}</span>}
            {profile.city && <span><MapPin size={14} aria-hidden="true" />{profile.city}</span>}
            <span><CalendarDays size={14} aria-hidden="true" />{t('profile:page.since', { date: joinedDate(profile.createdAt, language) })}</span>
          </>
        }
        actions={
          <>
            <Button type="primary" icon={<Store size={16} />} onClick={() => navigate('/seller/profile/settings')}>
              {t('profile:page.editStore')}
            </Button>
            <Button icon={<Settings size={16} />} onClick={() => navigate('/seller/profile/settings')}>
              {t('profile:view.settings')}
            </Button>
          </>
        }
        stats={stats}
      />
      <p className="pfStatNote">{t('profile:page.statNote')}</p>

      <UnderlineTabs<SellerTab> tabs={(['about', 'account', 'security'] as const).map((key) => ({ key, label: t(`profile:page.tab.${key}`) }))} active={tab} onChange={setTab} />

      <div className="pfPanel" key={tab}>
        {tab === 'about' && (
          <div className="pfGrid">
            <section className="pfCard pfSpan2">
              <h2 className="pfCardTitle">{t('profile:page.aboutStore')}</h2>
              <StoreDescription profile={profile} />
              <SocialLinks links={profile.socialLinks} />
            </section>
            <section className="pfCard">
              <h2 className="pfCardTitle">{t('profile:page.storeDetails')}</h2>
              <dl className="pfFacts">
                <Fact icon={LayoutGrid} label={t('profile:storeBrand.category')} value={category ?? t('profile:view.notSet')} />
                <Fact icon={MapPin} label={t('profile:storeBrand.city')} value={profile.city ?? t('profile:view.notSet')} />
                <Fact icon={ShieldCheck} label={t('profile:storeBrand.statusTitle')}
                  value={`${t(`profile:status.${profile.status}`)}${storeStatus ? ` · ${t('profile:storeBrand.statusSince', { date: new Date(storeStatus.since).toLocaleDateString() })}` : ''}`} />
                <Fact icon={Languages} label={t('profile:view.language')} value={profile.preferredLanguage === 'UR' ? 'اردو' : 'English'} />
              </dl>
            </section>
          </div>
        )}
        {tab === 'account' && <AccountPanel profile={profile} />}
        {tab === 'security' && <SecurityPanel role="SELLER" />}
      </div>
    </div>
  );
}

function StoreDescription({ profile }: { profile: SellerProfileDTO }) {
  const { t } = useTranslation(['profile']);
  const { language } = useLanguage();
  const primary = language === 'UR' ? profile.storeDescriptionUr : profile.storeDescription;
  const text = primary || profile.storeDescription || profile.storeDescriptionUr;
  const isUrdu = !!text && text === profile.storeDescriptionUr;

  if (!text) {
    return (
      <div className="pfEmptyNote">
        <p>{t('profile:page.noDescription')}</p>
        <Link to="/seller/profile/settings" className="pfTextLink">{t('profile:page.addDescription')}</Link>
      </div>
    );
  }
  return <p className="pfAbout" dir={isUrdu ? 'rtl' : 'ltr'}>{text}</p>;
}

const SOCIAL_ORDER = ['instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp', 'website'] as const;

function socialHref(platform: string, value: string): string {
  if (platform === 'whatsapp') return `https://wa.me/${value.replace(/[^\d]/g, '')}`;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function SocialLinks({ links }: { links: SellerProfileDTO['socialLinks'] }) {
  const { t } = useTranslation(['profile']);
  const present = SOCIAL_ORDER.filter((platform) => !!links[platform]);
  if (present.length === 0) {
    return (
      <p className="pfQuiet">
        {t('profile:page.noSocial')} <Link to="/seller/profile/settings" className="pfTextLink">{t('profile:page.addSocial')}</Link>
      </p>
    );
  }
  return (
    <ul className="pfSocial">
      {present.map((platform) => (
        <li key={platform}>
          <a href={socialHref(platform, links[platform] ?? '')} target="_blank" rel="noopener noreferrer" className="pfSocialChip">
            {platform === 'whatsapp' ? <MessageCircle size={15} aria-hidden="true" /> : <Globe size={15} aria-hidden="true" />}
            {t(`profile:page.social.${platform}`)}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="pfFact">
      <span className="pfFactIcon" aria-hidden="true"><Icon size={16} /></span>
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}

function AccountPanel({ profile }: { profile: ProfileDTO }) {
  const { t } = useTranslation(['profile']);
  const { language } = useLanguage();
  const base = profile.role === 'BUYER' || profile.role === 'SELLER' ? profileBasePath(profile.role) : null;
  return (
    <div className="pfGrid">
      <section className="pfCard pfSpan2">
        <h2 className="pfCardTitle">{t('profile:page.yourPhoto')}</h2>
        <p className="pfCardSub">{t('profile:page.yourPhotoHint')}</p>
        <AvatarUpload avatarUrl={profile.avatarUrl} />
      </section>
      <section className="pfCard">
        <h2 className="pfCardTitle">{t('profile:page.account')}</h2>
        <dl className="pfFacts">
          <Fact icon={UserRound} label={t('profile:view.role')} value={t(`profile:page.role.${profile.role}`)} />
          <Fact icon={ShieldCheck} label={t('profile:view.status')} value={t(`profile:status.${profile.status}`)} />
          <Fact icon={CalendarDays} label={t('profile:page.joined')} value={joinedDate(profile.createdAt, language)} />
        </dl>
        {base && (
          <Link to={`${base}/profile/settings`} className="pfRowLink">
            <Settings size={16} aria-hidden="true" /> {t('profile:page.notificationsLink')} <ChevronRight size={16} className="pfChevron" aria-hidden="true" />
          </Link>
        )}
      </section>
    </div>
  );
}

function SecurityPanel({ role }: { role: 'BUYER' | 'SELLER' }) {
  const { t } = useTranslation(['profile']);
  return (
    <section className="pfCard pfSecurity">
      <span className="pfSecurityIcon" aria-hidden="true"><KeyRound size={22} /></span>
      <div className="pfSecurityText">
        <h2 className="pfCardTitle">{t('profile:view.changePassword')}</h2>
        <p className="pfCardSub">{t('profile:page.passwordHint')}</p>
      </div>
      <Link to={`${profileBasePath(role)}/profile/change-password`} className="pfGhostBtn">
        {t('profile:view.changePassword')}
      </Link>
    </section>
  );
}

/* ── Buyer ───────────────────────────────────────────────────────────────────────────────── */

function BuyerProfile({ profile }: { profile: BuyerProfileDTO }) {
  const { t } = useTranslation(['profile', 'common', 'humanChat']);
  const { language } = useLanguage();
  const cacheProfile = useCacheProfile();
  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => { setDisplayName(profile.displayName ?? ''); }, [profile.displayName]);

  const orders = useQuery({ queryKey: [...buyerOrdersQueryKey(undefined), 'profile'], queryFn: () => listBuyerOrders(undefined, undefined) });
  const returns = useQuery({ queryKey: [...buyerReturnsQueryKey, 'profile'], queryFn: () => listBuyerReturns() });

  async function saveName() {
    if (!displayName.trim() || displayName.trim().length > 80) { setNameError(true); return; }
    setNameSaving(true); setNameError(false); setNameSaved(false);
    try {
      cacheProfile(await updateBuyerDisplayName(displayName.trim()));
      setNameSaved(true);
    } catch { setNameError(true); }
    finally { setNameSaving(false); }
  }

  const name = profile.displayName?.trim() || t('profile:page.buyerFallbackName');
  const stats: ProfileStat[] = [
    { key: 'orders', value: orders.isError ? '—' : pageCount(orders.data), label: t('profile:page.statMyOrders') },
    { key: 'returns', value: returns.isError ? '—' : pageCount(returns.data), label: t('profile:page.statMyReturns') },
  ];
  const shortcuts: Array<{ to: string; icon: LucideIcon; label: string; hint: string }> = [
    { to: '/orders', icon: Package, label: t('profile:page.shortcut.orders'), hint: t('profile:page.shortcut.ordersHint') },
    { to: '/returns', icon: RotateCcw, label: t('profile:page.shortcut.returns'), hint: t('profile:page.shortcut.returnsHint') },
    { to: '/buyer/profile/settings', icon: Settings, label: t('profile:view.settings'), hint: t('profile:page.shortcut.settingsHint') },
    { to: '/buyer/profile/change-password', icon: KeyRound, label: t('profile:view.changePassword'), hint: t('profile:page.shortcut.passwordHint') },
  ];

  return (
    <div className="pfPage pfPage--buyer">
      <ProfileHero
        mediaUrl={profile.avatarUrl}
        mediaShape="round"
        initial={name.charAt(0).toUpperCase()}
        mediaLabel={t('profile:page.changePhoto')}
        onMediaUpload={uploadAvatar}
        onUpdated={cacheProfile}
        name={name}
        meta={<span><CalendarDays size={14} aria-hidden="true" />{t('profile:page.memberSince', { date: joinedDate(profile.createdAt, language) })}</span>}
        stats={stats}
      />

      <div className="pfGrid">
        <section className="pfCard">
          <h2 className="pfCardTitle">{t('profile:page.yourDetails')}</h2>
          <p className="pfCardSub">{t('profile:page.nameHint')}</p>
          <label htmlFor="buyer-display-name" className="pfLabel">{t('humanChat:displayName')}</label>
          <div className="pfNameRow">
            <Input id="buyer-display-name" value={displayName} maxLength={80} status={nameError ? 'error' : undefined}
              onChange={(event) => { setDisplayName(event.target.value); setNameSaved(false); }}
              onPressEnter={() => void saveName()} />
            <Button type="primary" onClick={() => void saveName()} loading={nameSaving}>{t('humanChat:saveName')}</Button>
          </div>
          {nameError && <p className="pfError" role="alert">{t('humanChat:nameError')}</p>}
          {nameSaved && <p className="pfSaved" role="status">{t('profile:page.nameSaved')}</p>}
        </section>

        <section className="pfCard pfSpan2">
          <h2 className="pfCardTitle">{t('profile:page.shortcuts')}</h2>
          <ul className="pfShortcuts">
            {shortcuts.map(({ to, icon: Icon, label, hint }, index) => (
              <li key={to} style={{ animationDelay: `${index * 60}ms` }}>
                <Link to={to} className="pfShortcut">
                  <span className="pfShortcutIcon" aria-hidden="true"><Icon size={18} /></span>
                  <span className="pfShortcutText">
                    <strong>{label}</strong>
                    <span>{hint}</span>
                  </span>
                  <ChevronRight size={16} className="pfChevron" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ── Admin / Support (no profile route today; kept graceful) ─────────────────────────────── */

function StaffProfile({ profile }: { profile: ProfileDTO }) {
  const { t } = useTranslation(['profile']);
  const cacheProfile = useCacheProfile();
  return (
    <div className="pfPage">
      <ProfileHero
        mediaUrl={profile.avatarUrl}
        mediaShape="round"
        initial={profile.role.charAt(0)}
        mediaLabel={t('profile:page.changePhoto')}
        onMediaUpload={uploadAvatar}
        onUpdated={cacheProfile}
        name={t(`profile:page.role.${profile.role}`)}
        stats={[]}
      />
      <AccountPanel profile={profile} />
    </div>
  );
}
