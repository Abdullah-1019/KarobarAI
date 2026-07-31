import type { CartDTO, CartItemDTO, SellerCartGroupDTO } from '@karobarai/shared';
import { Prisma } from '@prisma/client';

import { ForbiddenError, NotFoundError } from '../../core/errors/AppError';
import { prisma } from '../../core/prisma';

// Feature 6 Task 1/2/3 — cart.repository.ts is intentionally not a separate file: consistent
// with catalog's Feature 4 precedent, this codebase keeps one *.service.ts per module rather
// than introducing a repository layer only some modules have.

const CART_ITEM_INCLUDE = {
  product: {
    include: {
      seller: { include: { user: { select: { publicId: true } } } },
      images: { where: { position: 0 }, take: 1 },
    },
  },
} satisfies Prisma.CartItemInclude;

type CartItemWithProduct = Prisma.CartItemGetPayload<{ include: typeof CART_ITEM_INCLUDE }>;

// Raw, precision-preserving shape (internal bigint ids, Prisma.Decimal amounts) — consumed by
// checkout.service.ts (modules/order) so the checkout transaction never has to re-parse the
// display DTO's rounded/stringified values back into numbers.
export interface RawCartItem {
  cartItemId: bigint;
  productId: bigint;
  productPublicId: string;
  titleEn: string;
  unitPrice: Prisma.Decimal;
  quantity: number;
  availableStock: number;
  isUnavailable: boolean;
  primaryImageUrl: string | null;
}

export interface RawSellerGroup {
  sellerId: bigint;
  sellerPublicId: string;
  storeName: string;
  items: RawCartItem[];
  subtotal: Prisma.Decimal;
  eligibleForCheckout: boolean;
}

export interface RawCart {
  cartId: bigint | null;
  sellerGroups: RawSellerGroup[];
}

async function getMinOrderValuePkr(): Promise<Prisma.Decimal> {
  const row = await prisma.platformConfig.findUnique({ where: { configKey: 'min_order_value_pkr' } });
  // Assumption: 100 PKR fallback if the config row is somehow missing (should never happen post-
  // seed) — never a hardcoded business value used in the actual comparison when the row exists.
  return new Prisma.Decimal(row ? Number(row.value) : 100);
}

async function getOrCreateCart(buyerId: bigint) {
  // Upsert keyed on the buyer_id UQ (Schema §4.8) — race-safe under concurrent first-add
  // requests; Postgres resolves the UQ conflict internally, never surfacing a constraint error.
  return prisma.cart.upsert({ where: { buyerId }, update: {}, create: { buyerId } });
}

// Task 4 — stock/availability conflict detection folded directly into cart retrieval (no
// separate GET /cart/validate endpoint — this module doc explicitly allows either shape).
// DRAFT/REMOVED products are treated as fully unavailable (available=0); OUT_OF_STOCK products
// are "available" at whatever their real stock value is (0, per Feature 4's system-derived
// transition) — both end up correctly flagged via the same `quantity > availableStock` check.
export async function getRawCart(buyerId: bigint): Promise<RawCart> {
  const cart = await prisma.cart.findUnique({ where: { buyerId } });
  if (!cart) return { cartId: null, sellerGroups: [] };

  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.cartId },
    include: CART_ITEM_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
  const minOrderValue = await getMinOrderValuePkr();

  const groups = new Map<string, RawSellerGroup>();

  for (const item of items) {
    const { product } = item;
    const sellerPublicId = product.seller.user.publicId;
    const isGone = product.deletedAt !== null || product.status === 'DRAFT' || product.status === 'REMOVED';
    const availableStock = isGone ? 0 : product.stock;
    const isUnavailable = isGone || availableStock < item.quantity;

    let group = groups.get(sellerPublicId);
    if (!group) {
      group = {
        sellerId: product.sellerId,
        sellerPublicId,
        storeName: product.seller.storeName,
        items: [],
        subtotal: new Prisma.Decimal(0),
        eligibleForCheckout: true, // finalized below, once all items are collected
      };
      groups.set(sellerPublicId, group);
    }

    group.items.push({
      cartItemId: item.cartItemId,
      productId: product.productId,
      productPublicId: product.publicId,
      titleEn: product.titleEn,
      unitPrice: product.price,
      quantity: item.quantity,
      availableStock,
      isUnavailable,
      primaryImageUrl: product.images[0]?.cdnUrl ?? null,
    });

    if (!isUnavailable) {
      group.subtotal = group.subtotal.plus(product.price.times(item.quantity));
    }
  }

  for (const group of groups.values()) {
    const hasConflict = group.items.some((i) => i.isUnavailable);
    group.eligibleForCheckout = !hasConflict && group.subtotal.gte(minOrderValue);
  }

  return { cartId: cart.cartId, sellerGroups: [...groups.values()] };
}

function toCartItemDTO(item: RawCartItem): CartItemDTO {
  return {
    id: item.cartItemId.toString(),
    productId: item.productPublicId,
    titleEn: item.titleEn,
    price: item.unitPrice.toFixed(2),
    quantity: item.quantity,
    lineSubtotal: item.unitPrice.times(item.quantity).toFixed(2),
    primaryImageUrl: item.primaryImageUrl,
    stockConflict: item.isUnavailable ? { available: item.availableStock } : null,
  };
}

export async function getCart(buyerId: bigint): Promise<CartDTO> {
  const raw = await getRawCart(buyerId);
  const minOrderValue = await getMinOrderValuePkr();
  const minOrderValuePkr = minOrderValue.toFixed(2);

  const sellerGroups: SellerCartGroupDTO[] = raw.sellerGroups.map((group) => ({
    sellerId: group.sellerPublicId,
    storeName: group.storeName,
    items: group.items.map(toCartItemDTO),
    subtotal: group.subtotal.toFixed(2),
    eligibleForCheckout: group.eligibleForCheckout,
    minOrderValuePkr,
  }));

  const grandSubtotal = raw.sellerGroups
    .reduce((sum, g) => sum.plus(g.subtotal), new Prisma.Decimal(0))
    .toFixed(2);

  return { sellerGroups, grandSubtotal };
}

export async function addCartItem(buyerId: bigint, productPublicId: string, quantity: number): Promise<CartDTO> {
  const product = await prisma.product.findUnique({ where: { publicId: productPublicId } });
  if (!product || product.deletedAt || product.status !== 'LIVE') {
    throw new NotFoundError('Product not found', undefined, 'PRODUCT_NOT_FOUND');
  }

  const cart = await getOrCreateCart(buyerId);

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.cartId, productId: product.productId } },
  });

  if (existing) {
    await prisma.cartItem.update({
      where: { cartItemId: existing.cartItemId },
      data: { quantity: existing.quantity + quantity },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.cartId, productId: product.productId, quantity },
    });
  }

  return getCart(buyerId);
}

async function loadOwnedCartItem(buyerId: bigint, cartItemId: bigint) {
  const item = await prisma.cartItem.findUnique({ where: { cartItemId }, include: { cart: true } });
  if (!item) {
    throw new NotFoundError('Cart item not found', undefined, 'CART_ITEM_NOT_FOUND');
  }
  if (item.cart.buyerId !== buyerId) {
    throw new ForbiddenError('This cart item does not belong to you', undefined, 'CART_ITEM_NOT_OWNED');
  }
  return item;
}

export async function updateCartItemQuantity(buyerId: bigint, cartItemId: bigint, quantity: number): Promise<CartDTO> {
  const item = await loadOwnedCartItem(buyerId, cartItemId);
  await prisma.cartItem.update({ where: { cartItemId: item.cartItemId }, data: { quantity } });
  return getCart(buyerId);
}

// Cart items are ephemeral working-state, not append-only/audited data (unlike orders) — a hard
// delete is correct here, no soft-delete pattern needed.
export async function removeCartItem(buyerId: bigint, cartItemId: bigint): Promise<CartDTO> {
  const item = await loadOwnedCartItem(buyerId, cartItemId);
  await prisma.cartItem.delete({ where: { cartItemId: item.cartItemId } });
  return getCart(buyerId);
}

// Called by checkout.service.ts (modules/order) after successfully creating orders for a set of
// seller groups — removes only the purchased items, never the whole cart (any newly-added or
// still-ineligible items from other sellers must remain untouched).
export async function removeCartItems(cartItemIds: bigint[]): Promise<void> {
  if (cartItemIds.length === 0) return;
  await prisma.cartItem.deleteMany({ where: { cartItemId: { in: cartItemIds } } });
}
