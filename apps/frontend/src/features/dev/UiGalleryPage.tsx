import { useState } from 'react';
import { Box, Check, ShoppingCart, Star } from 'lucide-react';

import type { ProductDetailDTO } from '@karobarai/shared';

import {
  AIHint,
  AiMark,
  Badge,
  BottomSheet,
  Breadcrumb,
  Button,
  EmptyState,
  PriceTag,
  ProductCardSkeleton,
  QuantityStepper,
  Rating,
  SectionHeader,
  Skeleton,
  StickyActionBar,
  StatusTag,
  toast,
} from '../../components';
import { ProductCard } from '../marketplace/ProductCard';

// Synthetic fixtures for the dev gallery only (route is DEV-gated) — labelled "Sample", never shown
// to real users, so the card can be reviewed without a running backend.
const PLACEHOLDER_SLUGS = [
  'fashion-clothing',
  'home-kitchen',
  'electronics',
  'mobile-accessories',
  'books-stationery',
  'beauty-personal-care',
  'grocery',
  'sports-outdoors',
];
const now = new Date().toISOString();
const SAMPLE_PRODUCTS: ProductDetailDTO[] = [
  { slug: 'fashion-clothing', title: 'Sample · Block-print cotton kurta', price: '2499.00', stock: 18, createdAt: now },
  { slug: 'home-kitchen', title: 'Sample · Hand-painted ceramic mug set', price: '1850.00', stock: 3, createdAt: '2025-01-01T00:00:00.000Z' },
  { slug: 'mobile-accessories', title: 'Sample · Braided fast-charging cable', price: '899.00', stock: 0, createdAt: now },
].map((p, i) => ({
  id: `sample-${i}`,
  titleEn: p.title,
  titleUr: null,
  descriptionEn: null,
  descriptionUr: null,
  price: p.price,
  stock: p.stock,
  condition: 'NEW',
  status: 'LIVE',
  aiGenerated: false,
  category: null,
  images: [{ id: `sample-img-${i}`, url: `/demo/products/${p.slug}.svg`, position: 0 }],
  createdAt: p.createdAt,
}));

export function UiGalleryPage() {
  const [qty, setQty] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="dev-gallery">
      <SectionHeader title="KarobarAI — UI Gallery (dev)" subtitle="Phase 1 shared components · EN/UR · LTR/RTL" />

      <section className="dev-gallery__group">
        <SectionHeader title="Buttons" />
        <div className="dev-gallery__grid">
          <Button variant="primary">Primary</Button>
          <Button variant="cta">CTA</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger-ghost">Delete</Button>
          <Button variant="primary" size="sm" icon={<Check size={16} />}>Small</Button>
          <Button variant="primary" size="lg" icon={<ShoppingCart size={18} />}>Large</Button>
          <Button variant="primary" loading>Loading</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </section>

      <section className="dev-gallery__group">
        <SectionHeader title="Badges" />
        <div className="dev-gallery__grid">
          <Badge variant="new">NEW</Badge>
          <Badge variant="sale">-20%</Badge>
          <Badge variant="cod">COD</Badge>
          <Badge variant="verified">Verified</Badge>
          <Badge variant="low-stock">Only 3 left</Badge>
          <Badge variant="out-of-stock">Sold out</Badge>
        </div>
      </section>

      <section className="dev-gallery__group">
        <SectionHeader title="Price, rating & quantity" />
        <div className="dev-gallery__grid">
          <PriceTag amount={2499} size="lg" strong />
          <PriceTag amount={1899} tone="brand" />
          <PriceTag amount={499} size="sm" muted />
          <Rating value={4.5} showCount count={128} />
          <QuantityStepper value={qty} min={1} max={10} onChange={setQty} />
          <span>{qty}</span>
        </div>
      </section>

      <section className="dev-gallery__group">
        <SectionHeader title="Breadcrumb" />
        <Breadcrumb
          items={[
            { label: 'Home', to: '/' },
            { label: 'Electronics', to: '/category/electronics' },
            { label: 'Wireless Earbuds' },
          ]}
        />
      </section>

      <section className="dev-gallery__group">
        <SectionHeader title="Product cards (sample data)" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--sp-4)', maxWidth: 760 }}>
          {SAMPLE_PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="dev-gallery__group">
        <SectionHeader title="Placeholder product images" subtitle="public/demo/products — used by the dev seed" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 'var(--sp-3)', maxWidth: 1100 }}>
          {PLACEHOLDER_SLUGS.map((slug) => (
            <img
              key={slug}
              src={`/demo/products/${slug}.svg`}
              alt=""
              style={{ width: '100%', aspectRatio: '4 / 5', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
            />
          ))}
        </div>
      </section>

      <section className="dev-gallery__group">
        <SectionHeader title="AI mark" />
        <div className="dev-gallery__grid">
          <AiMark size={16} />
          <AiMark size={24} />
          <AiMark size={40} />
          <AIHint label="Generated by AI — edit anything" />
        </div>
      </section>

      <section className="dev-gallery__group">
        <SectionHeader title="Status tags" />
        <div className="dev-gallery__grid">
          <StatusTag variant="success" label="Delivered" />
          <StatusTag variant="warning" label="Pending pickup" />
          <StatusTag variant="error" label="Cancelled" />
          <StatusTag variant="info" label="In transit" />
          <StatusTag variant="neutral" label="Draft" />
        </div>
      </section>

      <section className="dev-gallery__group">
        <SectionHeader title="Skeletons" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--sp-4)', maxWidth: 560 }}>
          <ProductCardSkeleton />
          <ProductCardSkeleton />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', maxWidth: 320, marginTop: 'var(--sp-4)' }}>
          <Skeleton width="80%" height={14} />
          <Skeleton width="60%" height={14} />
        </div>
      </section>

      <section className="dev-gallery__group">
        <SectionHeader title="Empty state" />
        <EmptyState
          title="No products found"
          description="Try a different search or clear your filters."
          actionLabel="Clear filters"
          onAction={() => toast.info('Filters cleared')}
        />
      </section>

      <section className="dev-gallery__group">
        <SectionHeader title="Overlays & feedback" />
        <div className="dev-gallery__grid">
          <Button variant="outline" icon={<Box size={16} />} onClick={() => setSheetOpen(true)}>
            Open bottom sheet
          </Button>
          <Button variant="outline" icon={<Star size={16} />} onClick={() => toast.success('Saved to your list')}>
            Success toast
          </Button>
          <Button variant="outline" onClick={() => toast.error('Something went wrong')}>Error toast</Button>
        </div>
      </section>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter products"
        footer={<Button variant="primary" fullWidth onClick={() => setSheetOpen(false)}>Show results</Button>}
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          The mobile filter sheet uses this shell. Swipe down or tap outside to dismiss.
        </p>
      </BottomSheet>

      <StickyActionBar>
        <PriceTag amount={qty * 2499} size="lg" strong />
        <Button variant="cta" icon={<ShoppingCart size={18} />}>Add to cart</Button>
      </StickyActionBar>
    </div>
  );
}
