import { Card, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { ProductDetailDTO } from '@karobarai/shared';
import { PriceDisplay, ProductThumbnail, StatusTag } from '../../components';
import { useLanguage } from '../../hooks';

interface ProductCardProps {
  product: ProductDetailDTO;
}

// UIUX §13 product-card spec: image 1:1, title EN/UR, price, status chip. Rebuilt in E2 — the
// previous version wrapped the whole card in a <Link> with no style reset, so the browser's
// default anchor color+underline bled through onto the title text (nothing inside an <a> resets
// text-decoration on its own; it has to be set on the anchor itself). That was the single
// strongest "reads as an unstyled template" tell on the Marketplace: every product/category title
// rendered as a literal blue underlined hyperlink instead of a designed title.
export function ProductCard({ product }: ProductCardProps) {
  const { t } = useTranslation(['marketplace']);
  const { language } = useLanguage();
  const title = language === 'UR' && product.titleUr ? product.titleUr : product.titleEn;
  const image = product.images[0]?.url ?? null;
  const outOfStock = product.stock <= 0 || product.status !== 'LIVE';

  return (
    <Link to={`/product/${product.id}`} className="karobarai-product-card" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
      <Card hoverable size="small" styles={{ body: { padding: 'var(--sp-3)' } }}>
        <div className="karobarai-product-card-media" style={{ position: 'relative' }}>
          <ProductThumbnail src={image} alt="" fill radius="md" />
          {outOfStock && (
            <div style={{ position: 'absolute', insetInlineStart: 'var(--sp-2)', top: 'var(--sp-2)' }}>
              <StatusTag variant="error" label={t('product.outOfStock')} />
            </div>
          )}
        </div>
        <Typography.Text
          ellipsis
          style={{
            display: 'block',
            marginTop: 'var(--sp-3)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
          }}
        >
          {title}
        </Typography.Text>
        <div style={{ marginTop: 'var(--sp-1)' }}>
          <PriceDisplay amount={product.price} />
        </div>
      </Card>
    </Link>
  );
}
