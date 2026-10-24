import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { ProductImageDTO, ProductVariantDTO } from '@karobarai/shared';
import { toast } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { formatCatalogError } from '../catalog/catalogErrors';
import { CART_QUERY_KEY, addCartItem } from './cartApi';
import { useGuestCartStore } from './guestCartStore';

// The minimal slice of ProductDetailDTO the add-to-cart flow needs. ProductDetailPage renders its
// quantity stepper off the full DTO, but ProductCard only has enough room for a one-tap "quick add"
// (quantity 1) — both funnel through this hook so the guest-vs-buyer branch and the error/toast
// handling exist in exactly one place. Previously ProductDetailPage carried this logic inline
// (addToCart()); the card would have been a second copy that could silently drift.
export interface AddableProduct {
  id: string;
  titleEn: string;
  price: string;
  images: ProductImageDTO[];
  variants?: ProductVariantDTO[];
}

// Guests hold the cart client-side (no backend guest-cart endpoint); authenticated Buyers hit the
// persisted cart. A Seller/Admin viewing the storefront is treated like a guest, matching
// ProductDetailPage's own `canBuy` rule.
export function useAddToCart() {
  const { t } = useTranslation(['marketplace', 'catalog']);
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const addGuestItem = useGuestCartStore((state) => state.addItem);

  const mutation = useMutation({
    mutationFn: (vars: { productId: string; quantity: number; variantId?: string }) => addCartItem(vars),
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_QUERY_KEY, cart);
      toast.success(t('marketplace:product.addedToCart'));
    },
    onError: (err) => toast.error(formatCatalogError(t, err)),
  });

  const addToCart = useCallback(
    (product: AddableProduct, quantity = 1, variant?: ProductVariantDTO) => {
      // Feature 23 — a product with sizes/colours is added only with one chosen.
      if (product.variants?.length && !variant) {
        toast.info(t('marketplace:product.chooseVariantFirst'));
        return Promise.resolve(false);
      }
      if (user?.role === 'BUYER') {
        // Resolves true once the server has the item (onError has already toasted a failure), so
        // a caller can play its "added" moment only for a real add.
        return mutation
          .mutateAsync({ productId: product.id, quantity, ...(variant ? { variantId: variant.id } : {}) })
          .then(() => true)
          .catch(() => false);
      }
      addGuestItem(
        {
          productId: product.id,
          titleEn: product.titleEn,
          price: product.price,
          primaryImageUrl: product.images[0]?.url ?? null,
          ...(variant ? { variantId: variant.id, variantLabel: variant.label } : {}),
        },
        quantity,
      );
      toast.success(t('marketplace:product.addedToCart'));
      return Promise.resolve(true);
    },
    [user, mutation, addGuestItem, t],
  );

  return { addToCart, isAdding: mutation.isPending };
}
