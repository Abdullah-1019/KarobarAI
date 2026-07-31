// Validation schemas live in packages/shared/src/schemas/cart.ts (checkout is grouped alongside
// cart/address there, not a separate shared-schema file, since it's this same feature's Task 7).
export { checkoutSchema } from '@karobarai/shared';
export type { CheckoutInput } from '@karobarai/shared';
