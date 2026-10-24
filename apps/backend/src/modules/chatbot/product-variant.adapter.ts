import { prisma } from '../../core/prisma';
import { variantLabel } from '../catalog/variant-label';

// The one place the chatbot reads product variants (size, colour). Values come from the store's
// active product_variants rows; the chatbot never invents an option or a stock count.

export interface VariantWish {
  size?: string;
  color?: string;
}

export interface ProductVariantOption {
  variantId: string;
  label: string;
  attributes: VariantWish;
  stock: number;
}

export type VariantMatch =
  | { kind: 'none_recorded' }
  | { kind: 'match'; variant: ProductVariantOption }
  | { kind: 'ambiguous'; options: ProductVariantOption[] }
  | { kind: 'unavailable'; options: ProductVariantOption[] };

const SIZE_ALIASES: Record<string, string> = { s: 'small', m: 'medium', l: 'large', med: 'medium', lrg: 'large', sm: 'small' };

/** Lower-cased, with common size shorthands expanded, so "M" and "medium" compare equal. */
export function normaliseOption(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const lower = value.trim().toLowerCase();
  return SIZE_ALIASES[lower] ?? lower;
}

export async function listProductVariants(productPublicId: string): Promise<ProductVariantOption[]> {
  const rows = await prisma.productVariant.findMany({
    where: { isActive: true, product: { publicId: productPublicId } },
    orderBy: [{ position: 'asc' }, { variantId: 'asc' }],
    select: { variantId: true, size: true, color: true, stock: true },
  });
  return rows.map((row) => ({
    variantId: row.variantId.toString(),
    label: variantLabel(row),
    attributes: { size: normaliseOption(row.size), color: normaliseOption(row.color) },
    stock: row.stock,
  }));
}

export function hasVariantWish(wish: VariantWish): boolean {
  return Boolean(wish.size || wish.color);
}

export function matchVariantIn(options: ProductVariantOption[], wish: VariantWish): VariantMatch {
  if (!options.length) return { kind: 'none_recorded' };
  const size = normaliseOption(wish.size);
  const color = normaliseOption(wish.color);
  const wanted = options.filter((option) =>
    (!size || option.attributes.size === size) && (!color || option.attributes.color === color));
  if (!wanted.length) return { kind: 'unavailable', options };
  if (wanted.length > 1) return { kind: 'ambiguous', options: wanted };
  return { kind: 'match', variant: wanted[0]! };
}

export async function matchVariant(productPublicId: string, wish: VariantWish): Promise<VariantMatch> {
  return matchVariantIn(await listProductVariants(productPublicId), wish);
}
