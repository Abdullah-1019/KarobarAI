import type { PaymentMethod } from '../enums/index';

// Feature 6 (Cart & Checkout) DTOs — Schema §4.4 (addresses), §4.8-4.9 (carts/cart_items),
// §4.10-4.12 (orders/order_items/payments).

export interface CartItemDTO {
  id: string; // cartItemId
  productId: string; // publicId of the product
  titleEn: string;
  price: string; // current live product price (not a snapshot — cart items aren't purchased yet)
  quantity: number;
  lineSubtotal: string;
  primaryImageUrl: string | null;
  // Present only when quantity now exceeds available stock (Task 4.2) — item stays in the
  // response, never silently dropped.
  stockConflict: { available: number } | null;
}

export interface SellerCartGroupDTO {
  sellerId: string; // seller's publicId
  storeName: string;
  items: CartItemDTO[];
  subtotal: string;
  // False if this group's subtotal is below platform_config.min_order_value_pkr (Task 4.4) or
  // any item in the group has a stockConflict — this group is excluded from checkout eligibility.
  eligibleForCheckout: boolean;
  minOrderValuePkr: string; // the config value that was checked against, for UI messaging
}

export interface CartDTO {
  sellerGroups: SellerCartGroupDTO[];
  grandSubtotal: string;
}

export interface AddressDTO {
  id: string;
  label: string | null;
  // Feature 6 schema addition — orders.ship_name (Schema §4.10/§14.4) needs a recipient name at
  // checkout time; no name field existed anywhere upstream (addresses/users/buyer_profiles).
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  contactPhone: string | null;
  isDefault: boolean;
}

export interface ShippingEstimateDTO {
  sellerId: string;
  shippingFee: string;
}

export interface CreatedOrderItemDTO {
  productId: string;
  titleSnapshot: string;
  unitPrice: string;
  quantity: number;
}

export interface CreatedOrderDTO {
  id: string; // order publicId
  sellerId: string;
  storeName: string;
  status: string;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  subtotal: string;
  shippingFee: string;
  totalAmount: string;
  items: CreatedOrderItemDTO[];
  placedAt: string;
}

export interface CheckoutResultDTO {
  orders: CreatedOrderDTO[];
}
