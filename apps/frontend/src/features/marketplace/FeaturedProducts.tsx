import { useTranslation } from 'react-i18next';

import type { ProductDetailDTO } from '@karobarai/shared';
import { ProductCard } from './ProductCard';
import { Rail } from './Rail';

interface FeaturedProductsProps {
  products: ProductDetailDTO[];
  title: string;
}

// Featured shelf on Home: the shared Rail (arrows, drag/swipe, edge fades, progress bar).
export function FeaturedProducts({ products, title }: FeaturedProductsProps) {
  const { t } = useTranslation(['marketplace']);
  return (
    <Rail
      title={title}
      subtitle={t('home.featuredSub')}
      prevLabel={t('featured.prev')}
      nextLabel={t('featured.next')}
      items={products.map((product) => ({ key: product.id, node: <ProductCard product={product} /> }))}
    />
  );
}
