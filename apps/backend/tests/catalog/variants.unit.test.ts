jest.mock('../../src/core/prisma', () => ({
  prisma: {
    product: { findUnique: jest.fn() },
    cart: { upsert: jest.fn(), findUnique: jest.fn() },
    cartItem: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    platformConfig: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { setProductVariantsSchema } from '@karobarai/shared';

import { prisma } from '../../src/core/prisma';
import { addCartItem } from '../../src/modules/cart/cart.service';
import { decrementStock, restoreStock } from '../../src/modules/catalog/catalog.service';
import { variantLabel } from '../../src/modules/catalog/variant-label';

const PRODUCT = '00000000-0000-4000-8000-000000000001';

describe('product variants (Feature 23)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(prisma.cart.upsert).mockResolvedValue({ cartId: 5n } as never);
    jest.mocked(prisma.cart.findUnique).mockResolvedValue(null as never);
  });

  it('validates the seller variant list', () => {
    expect(setProductVariantsSchema.safeParse({ variants: [{ size: 'M', color: 'Black', stock: 3 }] }).success).toBe(true);
    expect(setProductVariantsSchema.safeParse({ variants: [{ size: ' ', color: '', stock: 3 }] }).success).toBe(false);
    expect(setProductVariantsSchema.safeParse({ variants: [{ size: 'M', stock: 1 }, { size: 'm', stock: 2 }] }).success).toBe(false);
    expect(setProductVariantsSchema.safeParse({ variants: [{ size: 'M', stock: -1 }] }).success).toBe(false);
    expect(setProductVariantsSchema.safeParse({ variants: [] }).success).toBe(true);
  });

  it('labels a variant from its size and colour', () => {
    expect(variantLabel({ size: 'M', color: 'Black' })).toBe('M / Black');
    expect(variantLabel({ size: null, color: 'Red' })).toBe('Red');
  });

  it('requires a variant for a product that has them', async () => {
    jest.mocked(prisma.product.findUnique).mockResolvedValue({ productId: 1n, status: 'LIVE', deletedAt: null, variants: [{ variantId: 11n }] } as never);
    await expect(addCartItem(9n, PRODUCT, 1)).rejects.toMatchObject({ code: 'VARIANT_REQUIRED' });
    await expect(addCartItem(9n, PRODUCT, 1, '99')).rejects.toMatchObject({ code: 'VARIANT_NOT_FOUND' });
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });

  it('stores the chosen variant on its own cart line', async () => {
    jest.mocked(prisma.product.findUnique).mockResolvedValue({ productId: 1n, status: 'LIVE', deletedAt: null, variants: [{ variantId: 11n }] } as never);
    jest.mocked(prisma.cartItem.findFirst).mockResolvedValue(null as never);
    await addCartItem(9n, PRODUCT, 2, '11');
    expect(prisma.cartItem.findFirst).toHaveBeenCalledWith({ where: { cartId: 5n, productId: 1n, variantId: 11n } });
    expect(prisma.cartItem.create).toHaveBeenCalledWith({ data: { cartId: 5n, productId: 1n, variantId: 11n, quantity: 2 } });
  });

  it('keeps products without variants on a single plain line, as before', async () => {
    jest.mocked(prisma.product.findUnique).mockResolvedValue({ productId: 1n, status: 'LIVE', deletedAt: null, variants: [] } as never);
    jest.mocked(prisma.cartItem.findFirst).mockResolvedValue({ cartItemId: 3n, quantity: 1 } as never);
    await addCartItem(9n, PRODUCT, 2);
    expect(prisma.cartItem.findFirst).toHaveBeenCalledWith({ where: { cartId: 5n, productId: 1n, variantId: null } });
    expect(prisma.cartItem.update).toHaveBeenCalledWith({ where: { cartItemId: 3n }, data: { quantity: 3 } });
    await expect(addCartItem(9n, PRODUCT, 1, '11')).rejects.toMatchObject({ code: 'VARIANT_NOT_FOUND' });
  });

  it('decrements and restores the variant together with the product total', async () => {
    const tx = {
      productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      product: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ stock: 4, status: 'LIVE' }),
      },
    };
    await decrementStock(1n, 2, tx as never, 11n);
    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { variantId: 11n, productId: 1n, isActive: true, stock: { gte: 2 } }, data: { stock: { decrement: 2 } },
    });
    expect(tx.product.updateMany).toHaveBeenCalledWith({ where: { productId: 1n, stock: { gte: 2 } }, data: { stock: { decrement: 2 } } });
    await restoreStock(1n, 2, tx as never, 11n);
    expect(tx.productVariant.updateMany).toHaveBeenLastCalledWith({ where: { variantId: 11n, productId: 1n }, data: { stock: { increment: 2 } } });
  });

  it('refuses to oversell a variant and leaves the product total alone', async () => {
    const tx = {
      productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      product: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    };
    await expect(decrementStock(1n, 5, tx as never, 11n)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it('does not touch variants for products without them', async () => {
    const tx = {
      productVariant: { updateMany: jest.fn() },
      product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn().mockResolvedValue({ stock: 1, status: 'LIVE' }) },
    };
    await decrementStock(1n, 1, tx as never);
    expect(tx.productVariant.updateMany).not.toHaveBeenCalled();
  });
});
