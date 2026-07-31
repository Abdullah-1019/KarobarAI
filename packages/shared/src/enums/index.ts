// TS string-literal unions mirroring the Postgres enums (Schema Doc §3). Populated feature by
// feature as each domain lands — Auth needs these three immediately for the login/register/
// role-redirect screens; the rest (OrderStatus, PaymentStatus, ...) arrive with their features.

export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN' | 'SUPPORT';

export type UserStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'BANNED'
  | 'DEACTIVATED';

export type Language = 'EN' | 'UR';

export type PayoutWalletType = 'JAZZCASH' | 'EASYPAISA';

export type ProductStatus = 'DRAFT' | 'LIVE' | 'OUT_OF_STOCK' | 'REMOVED';

export type ProductCondition = 'NEW' | 'LIKE_NEW' | 'USED' | 'REFURBISHED';

export type PaymentMethod = 'JAZZCASH' | 'EASYPAISA' | 'COD';

export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

export type OrderStatus =
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'PROCESSING'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PENDING_MANUAL_LOGISTICS';
