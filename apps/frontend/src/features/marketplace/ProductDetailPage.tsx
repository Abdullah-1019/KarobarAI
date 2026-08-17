import { useState } from 'react';
import { Alert, Button, Carousel, Typography } from 'antd';
import { ImageOff } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { PriceDisplay, ProductThumbnail, QuantityStepper, SkeletonLoader, StatusTag, toast } from '../../components';
import type { ProductImageDTO } from '@karobarai/shared';
import { useLanguage } from '../../hooks';
import { useAuthStore } from '../../lib/authStore';
import { getProduct, productQueryKey } from '../catalog/catalogApi';
import { formatCatalogError } from '../catalog/catalogErrors';
import { CART_QUERY_KEY, addCartItem } from '../cart/cartApi';
import { useGuestCartStore } from '../cart/guestCartStore';

// E2: previously a raw <img> with no background/fallback — when a URL fails to load (any
// storage/network hiccup, e.g. this environment's object storage being unreachable), the entire
// hero image column rendered as a blank void with no visual boundary at all. Now matches
// ProductThumbnail's own placeholder treatment (warm-neutral box + icon) so a failed load reads
// as an intentional "no photo" state, not a broken page. Also switches the fixed height:360 crop
// to the same 1:1 aspect ratio ProductCard/ProductThumbnail already use everywhere else (UIUX
// §13: "product card image 1:1" — this was the one place in the app not following it).
function CarouselSlideImage({ image }: { image: ProductImageDTO }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        background: 'var(--bg-sunken)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ImageOff size={32} strokeWidth={1.5} color="var(--text-disabled)" aria-hidden="true" />
      {!failed && (
        <img
          src={image.url}
          alt=""
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity var(--dur-base) var(--ease)',
          }}
        />
      )}
    </div>
  );
}

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
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Alert type="error" showIcon message={formatCatalogError(t, error)} />
      </div>
    );
  }

  const title = language === 'UR' && product.titleUr ? product.titleUr : product.titleEn;
  const description = language === 'UR' && product.descriptionUr ? product.descriptionUr : product.descriptionEn;
  const outOfStock = product.stock <= 0 || product.status !== 'LIVE';
  const canBuy = (!user || user.role === 'BUYER') && !outOfStock;

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
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', gap: 'var(--sp-8)', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 360px', maxWidth: 420 }}>
        {product.images.length > 0 ? (
          <Carousel style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {product.images.map((image) => (
              <div key={image.id}>
                <CarouselSlideImage image={image} />
              </div>
            ))}
          </Carousel>
        ) : (
          <ProductThumbnail src={null} fill radius="md" />
        )}
      </div>

      <div style={{ flex: '1 1 320px' }}>
        <Typography.Title level={3} style={{ marginBottom: 'var(--sp-2)' }}>
          {title}
        </Typography.Title>
        <StatusTag variant="neutral" label={t(`catalog:condition.${product.condition}`)} />

        <div style={{ marginTop: 'var(--sp-3)' }}>
          <PriceDisplay amount={product.price} size="lg" />
        </div>

        <div style={{ marginTop: 'var(--sp-2)' }}>
          {outOfStock ? (
            <StatusTag variant="error" label={t('product.outOfStock')} />
          ) : (
            <Typography.Text type="secondary">{t('product.stockAvailable', { count: product.stock })}</Typography.Text>
          )}
        </div>

        {description && (
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <Typography.Text strong>{t('product.description')}</Typography.Text>
            <Typography.Paragraph style={{ marginTop: 'var(--sp-1)' }}>{description}</Typography.Paragraph>
          </div>
        )}

        {canBuy && (
          <div style={{ marginTop: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
            <div>
              <Typography.Text>{t('product.quantity')}</Typography.Text>
              <div style={{ marginTop: 'var(--sp-1)' }}>
                <QuantityStepper value={quantity} min={1} max={product.stock} onChange={setQuantity} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
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
