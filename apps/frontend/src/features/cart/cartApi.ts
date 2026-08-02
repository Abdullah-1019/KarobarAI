import type { AddressDTO, CartDTO, CheckoutResultDTO } from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

// Feature 6 (Cart & Checkout) — F6-cart-checkout-backend.md. Every cart/address mutation
// returns the full updated resource (confirmed against cart.controller.ts/address.controller.ts),
// not just the touched row — mirror those exact return types here.

export const CART_QUERY_KEY = ['cart'] as const;

export function getCart(): Promise<CartDTO> {
  return unwrap(apiClient.get<ApiEnvelope<CartDTO>>('/cart'));
}

export function addCartItem(input: { productId: string; quantity: number }): Promise<CartDTO> {
  return unwrap(apiClient.post<ApiEnvelope<CartDTO>>('/cart/items', input));
}

export function updateCartItem(itemId: string, quantity: number): Promise<CartDTO> {
  return unwrap(apiClient.patch<ApiEnvelope<CartDTO>>(`/cart/items/${itemId}`, { quantity }));
}

export function removeCartItem(itemId: string): Promise<CartDTO> {
  return unwrap(apiClient.delete<ApiEnvelope<CartDTO>>(`/cart/items/${itemId}`));
}

export const ADDRESSES_QUERY_KEY = ['cart', 'addresses'] as const;

export function listAddresses(): Promise<AddressDTO[]> {
  return unwrap(apiClient.get<ApiEnvelope<AddressDTO[]>>('/addresses'));
}

export interface AddressInput {
  label?: string | null;
  recipientName: string;
  line1: string;
  line2?: string | null;
  city: string;
  province: string;
  postalCode?: string | null;
  contactPhone: string;
}

export function createAddress(input: AddressInput): Promise<AddressDTO> {
  return unwrap(apiClient.post<ApiEnvelope<AddressDTO>>('/addresses', input));
}

export function updateAddress(id: string, input: Partial<AddressInput>): Promise<AddressDTO> {
  return unwrap(apiClient.patch<ApiEnvelope<AddressDTO>>(`/addresses/${id}`, input));
}

export function deleteAddress(id: string): Promise<{ deleted: true }> {
  return unwrap(apiClient.delete<ApiEnvelope<{ deleted: true }>>(`/addresses/${id}`));
}

export interface CheckoutInput {
  addressId: string;
  paymentMethod: 'JAZZCASH' | 'EASYPAISA' | 'COD';
}

// Requires a client-generated Idempotency-Key, reused across retries of the same checkout
// attempt — a resubmit with the same key returns the original result, never a second order set.
export function checkout(input: CheckoutInput, idempotencyKey: string): Promise<CheckoutResultDTO> {
  return unwrap(
    apiClient.post<ApiEnvelope<CheckoutResultDTO>>('/checkout', input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  );
}
