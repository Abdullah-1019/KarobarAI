import { Card, Typography } from 'antd';
import { Link } from 'react-router-dom';

import type { ProductDetailDTO } from '@karobarai/shared';
import { useLanguage } from '../../hooks';

interface ProductCardProps {
  product: ProductDetailDTO;
}

export function ProductCard({ product }: ProductCardProps) {
  const { language } = useLanguage();
  const title = language === 'UR' && product.titleUr ? product.titleUr : product.titleEn;
  const image = product.images[0]?.url ?? null;

  return (
    <Link to={`/product/${product.id}`}>
      <Card
        hoverable
        size="small"
        cover={
          image ? (
            <img src={image} alt="" style={{ height: 160, objectFit: 'cover' }} />
          ) : (
            <div style={{ height: 160, background: 'var(--bg-secondary, #f5f5f5)' }} />
          )
        }
        styles={{ body: { padding: 12 } }}
      >
        <Typography.Text ellipsis style={{ display: 'block' }}>
          {title}
        </Typography.Text>
        <Typography.Text strong>Rs. {Number(product.price).toLocaleString()}</Typography.Text>
      </Card>
    </Link>
  );
}
