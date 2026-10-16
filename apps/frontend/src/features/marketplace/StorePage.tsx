import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Empty, Image, Row, Skeleton, Space, Typography } from 'antd';
import { Link, useParams } from 'react-router-dom';

import { PriceDisplay, ProductThumbnail } from '../../components';
import { useLanguage } from '../../hooks';
import { getPublicStorefront } from './storeApi';
import { StoreChatWidget } from './StoreChatWidget';

export function StorePage() {
  const { storeSlug = '' } = useParams<{ storeSlug: string }>();
  const { language } = useLanguage();
  const languageCode = language.toLowerCase();
  const storeQuery = useQuery({
    queryKey: ['storefront', storeSlug],
    queryFn: () => getPublicStorefront(storeSlug),
    enabled: !!storeSlug,
  });

  if (storeQuery.isPending) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (storeQuery.isError || !storeQuery.data) {
    return <Alert type="error" showIcon message={language === 'UR' ? 'اسٹور دستیاب نہیں' : 'Store unavailable'} />;
  }

  const { store, products } = storeQuery.data;
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--sp-4)' }}>
      {store.bannerUrl && (
        <Image
          src={store.bannerUrl}
          alt=""
          preview={false}
          style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
        />
      )}
      <Space align="center" size="middle" style={{ margin: 'var(--sp-5) 0', flexWrap: 'wrap' }}>
        {store.logoUrl && <Image src={store.logoUrl} alt="" width={72} height={72} preview={false} style={{ objectFit: 'cover', borderRadius: '50%' }} />}
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>{store.name}</Typography.Title>
          {store.description && <Typography.Paragraph style={{ margin: 'var(--sp-2) 0 0' }}>{store.description}</Typography.Paragraph>}
        </div>
      </Space>
      <Typography.Title level={3}>{language === 'UR' ? 'مصنوعات' : 'Products'}</Typography.Title>
      {products.length === 0 ? (
        <Empty description={language === 'UR' ? 'اس اسٹور میں ابھی کوئی دستیاب پروڈکٹ نہیں' : 'No live products in this store yet'} />
      ) : (
        <Row gutter={[16, 16]}>
          {products.map((product) => (
            <Col key={product.id} xs={12} sm={8} md={6}>
              <Link to={`/product/${product.id}`} style={{ color: 'inherit' }}>
                <Card hoverable cover={<ProductThumbnail src={product.imageUrl} />}>
                  <Typography.Text strong ellipsis>{language === 'UR' && product.titleUr ? product.titleUr : product.titleEn}</Typography.Text>
                  <div style={{ marginTop: 'var(--sp-2)' }}><PriceDisplay amount={product.price} /></div>
                  <Typography.Text type="secondary">
                    {product.stock > 0
                      ? (language === 'UR' ? `دستیاب: ${product.stock}` : `In stock: ${product.stock}`)
                      : (language === 'UR' ? 'اسٹاک ختم' : 'Out of stock')}
                  </Typography.Text>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      )}
      <StoreChatWidget storeSlug={storeSlug} storeName={store.name} locale={languageCode === 'ur' ? 'ur' : 'en'} />
    </main>
  );
}
