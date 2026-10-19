import { useEffect, useMemo, useRef, useState } from 'react';
import { Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Camera, Globe, MapPin, MessageCircle, Music2, Package, Play, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { Breadcrumb, Button, EmptyState, Skeleton } from '../../components';
import { useLanguage } from '../../hooks';
import { tintFor } from './categoryVisuals';
import { ProductCard } from './ProductCard';
import { ProductGridSkeleton } from './ProductGridSkeleton';
import { StoreChatWidget } from './StoreChatWidget';
import { StoreMonogram } from './StoreMonogram';
import { getPublicStorefront, toCardProduct } from './storeApi';

type StoreSort = 'store' | 'price_asc' | 'price_desc';

// The public storefront (/store/:storeSlug), Studio Light (Day 2). A peach wash band carries the
// store's mark, name, description and facts that are true for every store (its live product count
// and cash on delivery), with the store's own goods standing in a small tilted "shop window" on the
// band's far side. Below it the store's whole shelf, filterable by the categories the store really
// stocks. The chat lives in the band as an ink button; once the band scrolls away a floating
// "Ask the store" pill takes over, stacked above the WhatsApp button rather than on top of it.
export function StorePage() {
  const { t } = useTranslation(['marketplace', 'common']);
  const navigate = useNavigate();
  const { storeSlug = '' } = useParams<{ storeSlug: string }>();
  const { language } = useLanguage();
  const isUr = language === 'UR';
  const [chatOpen, setChatOpen] = useState(false);
  const [bandVisible, setBandVisible] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<StoreSort>('store');
  const bandRef = useRef<HTMLElement>(null);

  const storeQuery = useQuery({
    queryKey: ['storefront', storeSlug],
    queryFn: () => getPublicStorefront(storeSlug),
    enabled: !!storeSlug,
  });

  useEffect(() => {
    setCategory(null);
    setSort('store');
  }, [storeSlug]);

  useEffect(() => {
    const el = bandRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(([entry]) => setBandVisible(entry?.isIntersecting ?? true), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [storeQuery.data]);

  const products = useMemo(() => storeQuery.data?.products ?? [], [storeQuery.data]);

  // Only the categories this store actually stocks, in shelf order, with how many of each.
  const categories = useMemo(() => {
    const seen = new Map<string, { slug: string; name: string; count: number }>();
    for (const p of products) {
      if (!p.category) continue;
      const entry = seen.get(p.category.slug);
      if (entry) entry.count += 1;
      else seen.set(p.category.slug, { slug: p.category.slug, name: isUr ? p.category.nameUr : p.category.nameEn, count: 1 });
    }
    return [...seen.values()];
  }, [products, isUr]);

  const shelf = useMemo(() => {
    const list = category ? products.filter((p) => p.category?.slug === category) : [...products];
    if (sort === 'price_asc') list.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === 'price_desc') list.sort((a, b) => Number(b.price) - Number(a.price));
    return list;
  }, [products, category, sort]);

  if (storeQuery.isPending) {
    return (
      <div className="store" aria-busy="true">
        <Skeleton height={340} radius="36px" style={{ display: 'block', marginBlockStart: 16 }} />
        <div className="store__shelf">
          <ProductGridSkeleton count={8} />
        </div>
      </div>
    );
  }

  if (storeQuery.isError || !storeQuery.data) {
    return (
      <div className="pdp-missing">
        <EmptyState
          headingLevel={1}
          title={t('store.unavailableTitle')}
          description={t('store.unavailableBody')}
          actionLabel={t('pdp.browse')}
          onAction={() => navigate('/search')}
        />
      </div>
    );
  }

  const { store } = storeQuery.data;
  const socialIcons = { facebook: Users, instagram: Camera, tiktok: Music2, youtube: Play, whatsapp: MessageCircle, website: Globe };
  const socialEntries = Object.entries(store.socialLinks).filter((entry): entry is [keyof typeof socialIcons, string] =>
    entry[0] in socialIcons && typeof entry[1] === 'string' && entry[1].startsWith('https://'));
  // The window shows the store's own goods: three real products with art, never stock imagery.
  const windowItems = products.filter((p) => p.imageUrl).slice(0, 3);

  return (
    <div className="store">
      <header className="store-band" ref={bandRef}>
        <div className="store-band__copy">
          <Breadcrumb items={[{ label: t('common:nav.home'), to: '/' }, { label: store.name }]} />
          <StoreMonogram name={store.name} logoUrl={store.logoUrl} size={72} className="store-band__mark" />
          <h1 className="store-band__title" dir="auto">{store.name}</h1>
          {(isUr ? store.descriptionUr ?? store.description : store.description ?? store.descriptionUr) && (
            <p className="store-band__desc" dir="auto">{isUr ? store.descriptionUr ?? store.description : store.description ?? store.descriptionUr}</p>
          )}
          {store.category && <p>{isUr ? store.category.nameUr : store.category.nameEn}</p>}
          <ul className="store-band__facts">
            {store.city && <li><MapPin size={16} aria-hidden="true" /><span dir="auto">{store.city}</span></li>}
            <li>
              <Package size={16} strokeWidth={1.9} aria-hidden="true" />
              {t('store.products', { count: products.length })}
            </li>
            <li>
              <Banknote size={16} strokeWidth={1.9} aria-hidden="true" />
              {t('store.cod')}
            </li>
          </ul>
          <p>{t('store.memberSince', { date: new Date(store.memberSince).toLocaleDateString(isUr ? 'ur-PK' : 'en-PK') })}</p>
          {socialEntries.length > 0 && (
            <div className="store-social-links" aria-label={t('store.socialLinks')}>
              {socialEntries.map(([platform, url]) => {
                const Icon = socialIcons[platform];
                return <a key={platform} href={url} target="_blank" rel="noopener noreferrer nofollow" aria-label={platform} title={platform}><Icon size={18} aria-hidden="true" /></a>;
              })}
            </div>
          )}
          <Button variant="secondary" icon={<MessageCircle size={18} aria-hidden="true" />} onClick={() => setChatOpen(true)}>
            {t('pdp.askStore')}
          </Button>
          <Button variant="outline" onClick={() => navigate(`/messages?store=${encodeURIComponent(storeSlug)}`)}>
            {t('humanChat:start')}
          </Button>
        </div>

        {store.bannerUrl ? (
          <div className="store-band__banner">
            <img src={store.bannerUrl} alt="" />
          </div>
        ) : (
          windowItems.length > 0 && (
            <div className="store-window" aria-hidden="true" data-count={windowItems.length}>
              {windowItems.map((p, index) => (
                <span key={p.id} className={`store-window__card store-window__card--${index}`}>
                  <span className="store-window__art" style={{ background: tintFor(p.category?.slug ?? '') }}>
                    <img src={p.imageUrl ?? ''} alt="" />
                  </span>
                </span>
              ))}
            </div>
          )
        )}
      </header>

      <section className="store__shelf" aria-labelledby="store-shelf-title">
        <header className="section-head store__head">
          <div className="section-head-text">
            <h2 id="store-shelf-title" className="section-title">
              {t('store.allProducts')}
            </h2>
          </div>
          {products.length > 1 && (
            <label className="browse__sort">
              <span className="browse__sort-label">{t('store.sortLabel')}</span>
              <Select
                popupMatchSelectWidth={false}
                value={sort}
                onChange={(value: StoreSort) => setSort(value)}
                options={[
                  { value: 'store', label: t('store.sortStore') },
                  { value: 'price_asc', label: t('filters.sortPriceAsc') },
                  { value: 'price_desc', label: t('filters.sortPriceDesc') },
                ]}
              />
            </label>
          )}
        </header>

        {categories.length > 1 && (
          <div className="filter-chips store__chips" role="group" aria-label={t('store.categoryFilter')}>
            <button type="button" className="filter-chip" aria-pressed={category === null} onClick={() => setCategory(null)}>
              {t('store.all')}
              <span className="store__chip-count">{products.length}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                className="filter-chip"
                aria-pressed={category === c.slug}
                onClick={() => setCategory(c.slug)}
              >
                {c.name}
                <span className="store__chip-count">{c.count}</span>
              </button>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <EmptyState
            title={t('store.emptyTitle')}
            description={t('store.emptyBody')}
            actionLabel={t('pdp.browse')}
            onAction={() => navigate('/search')}
          />
        ) : (
          <div className="product-grid">
            {shelf.map((p) => (
              <ProductCard key={p.id} product={toCardProduct(p)} />
            ))}
          </div>
        )}
      </section>

      <StoreChatWidget
        storeSlug={storeSlug}
        storeName={store.name}
        locale={isUr ? 'ur' : 'en'}
        open={chatOpen}
        onOpenChange={setChatOpen}
        showLauncher={!bandVisible}
      />
    </div>
  );
}
