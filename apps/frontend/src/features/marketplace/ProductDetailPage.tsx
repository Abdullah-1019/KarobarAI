import { useState } from 'react';
import { Alert, Button, Carousel, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { QuantityStepper, SkeletonLoader, toast } from '../../components';
import { useLanguage } from '../../hooks';
import { useAuthStore } from '../../lib/authStore';
import { getProduct, productQueryKey } from '../catalog/catalogApi';
import { formatCatalogError } from '../catalog/catalogErrors';
import { CART_QUERY_KEY, addCartItem } from '../cart/cartApi';
import { useGuestCartStore } from '../cart/guestCartStore';

// SCR-B03 — evaluate + buy. Wishlist is Future (F17) — no affordance for it anywhere here.
export function ProductDetailPage() {
  const { t } = useTranslation(['marketplace', 'catalog']);
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  // Actions only, called from event handlers — no need to subscribe this component to the
  // guest cart's `items` array (CartPage.tsx is the one that reads items reactively).
  const addGuestItem = useGuestCartStore((s) => s.addItem);

  const [quantity, setQuantity] = useState(1);

  const { data: product, isPending, isError, error } = useQuery({
    queryKey: productQueryKey(id),
    queryFn: () => getProduct(id),
    enabled: !!id,
  });

  const addToCartMutation = useMutation({
    mutationFn: () => addCartItem({ productId: id, quantity }),
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_QUERY_KEY, cart);
      toast.success(t('product.addedToCart'));
    },
    onError: (err) => toast.error(formatCatalogError(t, err)),
  });

  if (isPending) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert type="error" showIcon message={formatCatalogError(t, error)} />
      </div>
    );
  }

  const title = language === 'UR' && product.titleUr ? product.titleUr : product.titleEn;
  const description = language === 'UR' && product.descriptionUr ? product.descriptionUr : product.descriptionEn;
  const canBuy = (!user || user.role === 'BUYER') && product.stock > 0 && product.status === 'LIVE';

  function addToCart() {
    if (user?.role === 'BUYER') {
      addToCartMutation.mutate();
      return;
    }
    if (!product) return;
    addGuestItem(
      {
        productId: product.id,
        titleEn: product.titleEn,
        price: product.price,
        primaryImageUrl: product.images[0]?.url ?? null,
      },
      quantity,
    );
    toast.success(t('product.addedToCart'));
  }

  async function buyNow() {
    if (!product) return;
    if (!user) {
      addGuestItem(
        {
          productId: product.id,
          titleEn: product.titleEn,
          price: product.price,
          primaryImageUrl: product.images[0]?.url ?? null,
        },
        quantity,
      );
      navigate('/login', { state: { redirect: '/checkout' } });
      return;
    }
    try {
      const cart = await addCartItem({ productId: id, quantity });
      queryClient.setQueryData(CART_QUERY_KEY, cart);
      navigate('/checkout');
    } catch (err) {
      toast.error(formatCatalogError(t, err));
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sp-6, 24px)', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 360px', maxWidth: 420 }}>
        {product.images.length > 0 ? (
          <Carousel>
            {product.images.map((image) => (
              <div key={image.id}>
                <img src={image.url} alt="" style={{ width: '100%', height: 360, objectFit: 'cover' }} />
              </div>
            ))}
          </Carousel>
        ) : (
          <div style={{ width: '100%', height: 360, background: 'var(--bg-secondary, #f5f5f5)' }} />
        )}
      </div>

      <div style={{ flex: '1 1 320px' }}>
        <Typography.Title level={3}>{title}</Typography.Title>
        <Tag>{t(`catalog:condition.${product.condition}`)}</Tag>
        <Typography.Title level={4} style={{ marginTop: 12 }}>
          Rs. {Number(product.price).toLocaleString()}
        </Typography.Title>

        {product.stock > 0 ? (
          <Typography.Text type="secondary">{t('product.stockAvailable', { count: product.stock })}</Typography.Text>
        ) : (
          <Typography.Text type="danger">{t('product.outOfStock')}</Typography.Text>
        )}

        {description && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text strong>{t('product.description')}</Typography.Text>
            <Typography.Paragraph>{description}</Typography.Paragraph>
          </div>
        )}

        {canBuy && (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <Typography.Text>{t('product.quantity')}</Typography.Text>
              <div style={{ marginTop: 4 }}>
                <QuantityStepper value={quantity} min={1} max={product.stock} onChange={setQuantity} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button size="large" loading={addToCartMutation.isPending} onClick={addToCart}>
                {t('product.addToCart')}
              </Button>
              <Button type="primary" size="large" onClick={buyNow}>
                {t('product.buyNow')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
