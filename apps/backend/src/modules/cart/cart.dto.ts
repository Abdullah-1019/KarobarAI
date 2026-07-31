// Validation schemas live in packages/shared/src/schemas/cart.ts (TRD §4: shared Zod schemas
// with the API contract), same pattern as every other module's dto.ts.
export { addCartItemSchema, updateCartItemSchema } from '@karobarai/shared';
export type { AddCartItemInput, UpdateCartItemInput } from '@karobarai/shared';
