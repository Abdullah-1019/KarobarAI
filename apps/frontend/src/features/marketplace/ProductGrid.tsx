import type { ProductDetailDTO } from '@karobarai/shared';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: ProductDetailDTO[];
}

// Was three separate copies of the same `display:grid; auto-fill minmax(180px,1fr)` markup
// (HomePage's featured + new-arrivals sections, SearchResultsGrid). Feature-scoped rather than a
// components/ primitive since it's tightly coupled to ProductCard/ProductDetailDTO, both
// marketplace-owned.
//
// E2: minmax tightened from 180px to 150px — at a 320-375px mobile viewport, 180px only ever fit
// one column (minus content-area padding, two 180px tiles plus a gap never fit under 376px),
// producing a single full-bleed column and a very long scroll for a 24-card grid. 150px lets the
// same auto-fill mechanism settle into 2 columns on a real phone without any separate
// mobile-specific breakpoint logic — still purely responsive, not a second layout.
export function ProductGrid({ products }: ProductGridProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--sp-4)' }}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
