import { useState } from 'react';
import { Box, Check, ShoppingCart, Star } from 'lucide-react';

import {
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
  toast,
} from '../../components';

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
