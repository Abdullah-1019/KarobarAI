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
