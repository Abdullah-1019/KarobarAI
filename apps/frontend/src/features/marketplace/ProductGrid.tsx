import type { ProductDetailDTO } from '@karobarai/shared';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: ProductDetailDTO[];
}

// Feature-scoped rather than a components/ primitive since it's tightly coupled to ProductCard and
// ProductDetailDTO, both marketplace-owned.
//
// Columns are explicit (4 desktop / 3 tablet / 2 phone) via the `.product-grid` class rather than
// the old `auto-fill, minmax(150px, 1fr)`: a minmax grid kept packing in columns as the content
// column widened, so a 1280px Home was rendering seven cramped 150px cards. A fixed rhythm makes
// card size predictable and matches the Home redesign's 4/3/2 spec (Phase 6).
export function ProductGrid({ products }: ProductGridProps) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
