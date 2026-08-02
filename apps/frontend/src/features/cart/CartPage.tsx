import { Alert, Button, Card, Divider, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import type { CartItemDTO, SellerCartGroupDTO } from '@karobarai/shared';
import { EmptyState, QuantityStepper, SkeletonLoader, toast } from '../../components';
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
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader rows={4} />
      </div>
    );
  }

  if (isBuyer && isError) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
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
      <Card key={group.sellerId} title={group.storeName} style={{ marginBottom: 16 }}>
        {group.items.map((item: CartItemDTO) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0' }}>
            {item.primaryImageUrl ? (
              <img src={item.primaryImageUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4 }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 4, background: 'var(--bg-secondary, #f5f5f5)' }} />
            )}
            <div style={{ flex: 1 }}>
              <Typography.Text>{item.titleEn}</Typography.Text>
              <div>Rs. {Number(item.price).toLocaleString()}</div>
              {item.stockConflict && (
                <Typography.Text type="danger">
                  {t('item.stockConflict', { count: item.stockConflict.available })}
                </Typography.Text>
              )}
            </div>
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
        ))}
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography.Text strong>{t('sellerGroup.subtotal')}</Typography.Text>
          <Typography.Text strong>Rs. {Number(group.subtotal).toLocaleString()}</Typography.Text>
        </div>
        {!group.eligibleForCheckout && (
          <Typography.Text type="warning">
            {t('sellerGroup.belowMinimum', { amount: `Rs. ${Number(group.minOrderValuePkr).toLocaleString()}` })}
          </Typography.Text>
        )}
      </Card>
    );
  }

  function renderGuestItem(item: GuestCartItem) {
    return (
      <div key={item.productId} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0' }}>
        {item.primaryImageUrl ? (
          <img src={item.primaryImageUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 4, background: 'var(--bg-secondary, #f5f5f5)' }} />
        )}
        <div style={{ flex: 1 }}>
          <Typography.Text>{item.titleEn}</Typography.Text>
          <div>Rs. {Number(item.price).toLocaleString()}</div>
        </div>
        <QuantityStepper value={item.quantity} min={1} onChange={(quantity) => updateGuestQuantity(item.productId, quantity)} />
        <Button type="link" danger onClick={() => removeGuestItem(item.productId)}>
          {t('item.remove')}
        </Button>
      </div>
    );
  }

  const guestTotal = guestItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('page.title')}</Typography.Title>
      <Typography.Text type="secondary">{t('page.shippingNote')}</Typography.Text>

      <div style={{ marginTop: 16 }}>
        {isBuyer
          ? cart?.sellerGroups.map(renderBuyerGroup)
          : (
              <Card>
                {guestItems.map(renderGuestItem)}
              </Card>
            )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t('page.grandTotal')}: Rs. {Number(isBuyer ? cart?.grandSubtotal ?? 0 : guestTotal).toLocaleString()}
        </Typography.Title>
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
    </div>
  );
}
