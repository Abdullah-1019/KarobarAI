import { Alert, Button, Card, Divider, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import type { CartItemDTO, SellerCartGroupDTO } from '@karobarai/shared';
import { EmptyState, PriceDisplay, ProductThumbnail, QuantityStepper, SkeletonLoader, StatusTag, toast } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { CART_QUERY_KEY, getCart, removeCartItem, updateCartItem } from './cartApi';
import { formatCartError } from './cartErrors';
import { useGuestCartStore, type GuestCartItem } from './guestCartStore';

// SCR-B04 — review items before checkout, grouped by seller (preview of order splitting).
// Guests get a client-only view of the localStorage cart; a signed-in Buyer gets the persisted
// one — same page, branched by auth state, rather than two parallel screens.
export function CartPage() {
  const { t } = useTranslation(['cart']);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isBuyer = user?.role === 'BUYER';
  const queryClient = useQueryClient();

  const { data: cart, isPending, isError, error } = useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: getCart,
    enabled: isBuyer,
  });

  const guestItems = useGuestCartStore((s) => s.items);
  const updateGuestQuantity = useGuestCartStore((s) => s.updateQuantity);
  const removeGuestItem = useGuestCartStore((s) => s.removeItem);

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => updateCartItem(itemId, quantity),
    onSuccess: (updated) => queryClient.setQueryData(CART_QUERY_KEY, updated),
    onError: (err) => toast.error(formatCartError(t, err)),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeCartItem(itemId),
    onSuccess: (updated) => queryClient.setQueryData(CART_QUERY_KEY, updated),
    onError: (err) => toast.error(formatCartError(t, err)),
  });

  if (isBuyer && isPending) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <SkeletonLoader rows={4} />
      </div>
    );
  }

  if (isBuyer && isError) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Alert type="error" showIcon message={formatCartError(t, error)} />
      </div>
    );
  }

  const isEmpty = isBuyer ? (cart?.sellerGroups.length ?? 0) === 0 : guestItems.length === 0;

  if (isEmpty) {
    return (
      <EmptyState title={t('page.title')} description={t('page.empty')} actionLabel={t('page.browseCta')} onAction={() => navigate('/')} />
    );
  }

  function renderBuyerGroup(group: SellerCartGroupDTO) {
    return (
      <Card key={group.sellerId} title={group.storeName} style={{ marginBottom: 'var(--sp-4)' }}>
        {group.items.map((item: CartItemDTO, index) => (
          <div
            key={item.id}
            className="karobarai-cart-item"
            style={{
              padding: 'var(--sp-3) 0',
              borderBottom: index === group.items.length - 1 ? 'none' : '1px solid var(--border)',
            }}
          >
            <ProductThumbnail src={item.primaryImageUrl} size={64} />
            <div className="karobarai-cart-item-info">
              <Typography.Text ellipsis style={{ display: 'block' }}>
                {item.titleEn}
              </Typography.Text>
              <PriceDisplay amount={item.price} size="sm" muted />
              {item.stockConflict && (
                <div style={{ marginTop: 'var(--sp-1)' }}>
                  <StatusTag variant="warning" label={t('item.stockConflict', { count: item.stockConflict.available })} />
                </div>
              )}
            </div>
            <div className="karobarai-cart-item-controls">
              <QuantityStepper
                value={item.quantity}
                min={1}
                max={item.stockConflict?.available}
                disabled={updateMutation.isPending}
                onChange={(quantity) => updateMutation.mutate({ itemId: item.id, quantity })}
              />
              <Button type="link" danger loading={removeMutation.isPending} onClick={() => removeMutation.mutate(item.id)}>
                {t('item.remove')}
              </Button>
            </div>
          </div>
        ))}
        <Divider style={{ margin: 'var(--sp-2) 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography.Text strong>{t('sellerGroup.subtotal')}</Typography.Text>
          <PriceDisplay amount={group.subtotal} />
        </div>
        {!group.eligibleForCheckout && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 'var(--sp-3)' }}
            message={t('sellerGroup.belowMinimum', { amount: `Rs. ${Number(group.minOrderValuePkr).toLocaleString()}` })}
          />
        )}
      </Card>
    );
  }

  function renderGuestItem(item: GuestCartItem, isLast: boolean) {
    return (
      <div
        key={item.productId}
        className="karobarai-cart-item"
        style={{
          padding: 'var(--sp-3) 0',
          borderBottom: isLast ? 'none' : '1px solid var(--border)',
        }}
      >
        <ProductThumbnail src={item.primaryImageUrl} size={64} />
        <div className="karobarai-cart-item-info">
          <Typography.Text ellipsis style={{ display: 'block' }}>
            {item.titleEn}
          </Typography.Text>
          <PriceDisplay amount={item.price} size="sm" muted />
        </div>
        <div className="karobarai-cart-item-controls">
          <QuantityStepper value={item.quantity} min={1} onChange={(quantity) => updateGuestQuantity(item.productId, quantity)} />
          <Button type="link" danger onClick={() => removeGuestItem(item.productId)}>
            {t('item.remove')}
          </Button>
        </div>
      </div>
    );
  }

  const guestTotal = guestItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Typography.Title level={3} style={{ marginBottom: 'var(--sp-1)' }}>
        {t('page.title')}
      </Typography.Title>
      <Typography.Text type="secondary">{t('page.shippingNote')}</Typography.Text>

      <div style={{ marginTop: 'var(--sp-4)' }}>
        {isBuyer
          ? cart?.sellerGroups.map(renderBuyerGroup)
          : (
              <Card>
                {guestItems.map((item, index) => renderGuestItem(item, index === guestItems.length - 1))}
              </Card>
            )}
      </div>

      <Card
        className="karobarai-cart-summary"
        style={{
          marginTop: 'var(--sp-6)',
          position: 'sticky',
          bottom: 'var(--sp-4)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Typography.Text type="secondary" style={{ display: 'block' }}>
              {t('page.grandTotal')}
            </Typography.Text>
            <PriceDisplay amount={isBuyer ? cart?.grandSubtotal ?? 0 : guestTotal} size="lg" />
          </div>
          {isBuyer ? (
            <Button
              type="primary"
              size="large"
              disabled={!cart?.sellerGroups.some((g) => g.eligibleForCheckout)}
              onClick={() => navigate('/checkout')}
            >
              {t('page.checkout')}
            </Button>
          ) : (
            <Link to="/login" state={{ redirect: '/checkout' }}>
              <Button type="primary" size="large">
                {t('page.checkout')}
              </Button>
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
