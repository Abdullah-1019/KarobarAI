import axios from 'axios';
import { z } from 'zod';

import { config } from '../../core/config';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import * as cartService from '../cart/cart.service';
import { variantLabel } from '../catalog/variant-label';
import { searchCatalog } from './product-search.service';
import { matchVariantIn, normaliseOption, type ProductVariantOption, type VariantWish } from './product-variant.adapter';
import { retrieveRelevantProducts } from './rag.service';
import type { BuyerStoreContext } from './buyer-context-builder.service';
import type { ChatToolDefinition, ToolCall } from './slm-client';

const searchSchema = z.object({ query: z.string().trim().min(2).max(300) }).strict();
const productSchema = z.object({ productId: z.string().uuid() }).strict();
const variantSchema = z.object({
  productId: z.string().uuid(),
  variantAttributes: z.record(z.string(), z.unknown()),
}).strict();
const addSchema = variantSchema.extend({
  quantity: z.number().int().min(1).max(99),
  variantId: z.string().regex(/^\d+$/).optional(),
}).strict();
const noArgsSchema = z.object({}).strict();
const policySchema = z.object({ topic: z.enum(['returns', 'shipping', 'payment']) }).strict();

export const buyerTools: ChatToolDefinition[] = [
  { name: 'search_products', description: 'Search this store catalog for relevant live products.', parameters: { query: 'string' } },
  { name: 'get_product_details', description: 'Read grounded details for a live product in this store.', parameters: { productId: 'string' } },
  { name: 'select_variant', description: 'Validate a product variant. This store only has variants when explicitly present in product data.', parameters: { productId: 'string', variantAttributes: 'object' } },
  { name: 'add_to_cart', description: 'Add an in-stock product to the authenticated buyer cart.', parameters: { productId: 'string', variantAttributes: 'object', quantity: 'number' } },
  { name: 'check_cart', description: 'Read this buyer cart items for the current store.', parameters: {} },
  { name: 'get_store_policy', description: 'Read a store-specific policy if one is configured.', parameters: { topic: "'returns' | 'shipping' | 'payment'" } },
  { name: 'redirect_checkout', description: 'Signal the frontend to open the existing checkout page after cart confirmation.', parameters: {} },
];

const quantitySchema = productSchema.extend({ quantity: z.number().int().min(1).max(99) }).strict();

// Tools for requests that choose a mode (Fast or Slow). Requests without a mode keep buyerTools
// unchanged so the original prompt is not altered.
export const buyerModeTools: ChatToolDefinition[] = [
  ...buyerTools,
  { name: 'remove_from_cart', description: 'Remove this store product from the authenticated buyer cart.', parameters: { productId: 'string' } },
  { name: 'update_cart_quantity', description: 'Set the cart quantity of this store product for the authenticated buyer.', parameters: { productId: 'string', quantity: 'number' } },
];

export interface BuyerToolOptions {
  /** 'keyword' searches the catalog in the database, without the local embedding model. */
  search?: 'vector' | 'keyword';
}

async function embedQuery(query: string): Promise<number[]> {
  const response = await axios.post<{ embeddings: number[][] }>(
    `${config.aiServiceUrl}/internal/embeddings`,
    { texts: [query] },
    { timeout: 60_000 },
  );
  const vector = response.data.embeddings?.[0];
  if (!Array.isArray(vector) || vector.length !== 768 || vector.some((value) => !Number.isFinite(value))) {
    throw new Error('Embedding service returned an invalid query vector');
  }
  return vector;
}

function productFacts(product: {
  publicId: string;
  titleEn: string;
  titleUr: string | null;
  descriptionEn: string | null;
  descriptionUr: string | null;
  price: { toString(): string };
  stock: number;
  status: string;
  tags: unknown;
  variants?: Array<{ variantId: bigint; size: string | null; color: string | null; stock: number }>;
}) {
  return {
    productId: product.publicId,
    titleEn: product.titleEn,
    titleUr: product.titleUr,
    descriptionEn: product.descriptionEn,
    descriptionUr: product.descriptionUr,
    price: product.price.toString(),
    currency: 'PKR',
    stock: product.stock,
    status: product.status,
    tags: Array.isArray(product.tags) ? product.tags : [],
    // Recorded size/colour options with their own stock; empty when the product has none.
    variants: (product.variants ?? []).map((variant) => ({ variantId: variant.variantId.toString(), label: variantLabel(variant), stock: variant.stock })),
  };
}

async function findStoreProduct(storeId: bigint, productPublicId: string) {
  const product = await prisma.product.findFirst({
    where: { publicId: productPublicId, sellerId: storeId, status: 'LIVE', deletedAt: null },
    include: {
      category: { select: { slug: true, nameEn: true, nameUr: true } },
      images: { where: { position: 0 }, take: 1 },
      variants: { where: { isActive: true }, orderBy: [{ position: 'asc' }, { variantId: 'asc' }], select: { variantId: true, size: true, color: true, stock: true } },
    },
  });
  if (!product) {
    logger.warn({ storeId: storeId.toString(), productPublicId }, 'buyer chatbot rejected product outside store or not live');
  }
  return product;
}

function scopedCart(context: BuyerStoreContext, cart: Awaited<ReturnType<typeof cartService.getCart>>) {
  return {
    ...cart,
    sellerGroups: cart.sellerGroups.filter((group) => group.sellerId === context.store.publicId),
  };
}

async function keywordSearch(storeId: bigint, query: string) {
  const terms = [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}-]+/u).filter((word) => word.length > 2))].slice(0, 4);
  if (!terms.length) return [];
  const all = await searchCatalog(storeId, { terms, stock: 'any' }, 0, 8);
  let items = all.items;
  if (!items.length && terms.length > 1) {
    // No listing has every word: fall back to listings matching any single word.
    const seen = new Set<string>();
    for (const term of terms) {
      for (const item of (await searchCatalog(storeId, { terms: [term], stock: 'any' }, 0, 8)).items) {
        if (!seen.has(item.productId) && seen.size < 8) { seen.add(item.productId); items = [...items, item]; }
      }
    }
  }
  return items.map((item) => ({ ...item, currency: 'PKR', variants: [] }));
}

export async function executeBuyerTool(
  context: BuyerStoreContext,
  buyerUserId: bigint | undefined,
  toolCall: ToolCall,
  options: BuyerToolOptions = {},
): Promise<unknown> {
  switch (toolCall.type) {
    case 'search_products': {
      const args = searchSchema.safeParse(toolCall.payload);
      if (!args.success) return { ok: false, error: 'Invalid search request.' };
      if (options.search === 'keyword') return keywordSearch(context.storeId, args.data.query);
      const vector = await embedQuery(args.data.query);
      const products = await retrieveRelevantProducts(context.storeId, vector, 8);
      return products.map(productFacts);
    }
    case 'get_product_details': {
      const args = productSchema.safeParse(toolCall.payload);
      if (!args.success) return { ok: false, error: 'Invalid product request.' };
      const product = await findStoreProduct(context.storeId, args.data.productId);
      return product ? { ...productFacts(product), category: product.category, imageUrl: product.images[0]?.cdnUrl ?? null } : { ok: false, error: 'Product not found in this store.' };
    }
    case 'select_variant': {
      const args = variantSchema.safeParse(toolCall.payload);
      if (!args.success) return { ok: false, error: 'Invalid variant request.' };
      const product = await findStoreProduct(context.storeId, args.data.productId);
      if (!product) return { ok: false, error: 'Product not found in this store.' };
      const recorded = product.variants ?? [];
      if (!recorded.length) {
        // No recorded variants: never infer or accept unrecorded options.
        if (Object.keys(args.data.variantAttributes).length > 0) {
          return { ok: false, error: 'This product has no recorded variants. Ask the buyer to choose another listed product.' };
        }
        return { ok: true, productId: product.publicId, variantAttributes: {} };
      }
      const match = matchVariantIn(toOptions(recorded), wishFrom(args.data.variantAttributes));
      if (match.kind !== 'match') {
        return { ok: false, error: 'Ask the buyer to choose one of the listed sizes/colours.', options: toOptions(recorded).map(({ variantId, label, stock }) => ({ variantId, label, stock })) };
      }
      return { ok: true, productId: product.publicId, variantId: match.variant.variantId, label: match.variant.label, stock: match.variant.stock };
    }
    case 'add_to_cart': {
      const args = addSchema.safeParse(toolCall.payload);
      if (!args.success) return { ok: false, error: 'Invalid cart request.' };
      if (!buyerUserId) return { ok: false, error: 'Sign in as a buyer before adding products to the saved cart.' };
      const product = await findStoreProduct(context.storeId, args.data.productId);
      if (!product) return { ok: false, error: 'Product not found in this store; no cart item was added.' };
      // Products with recorded variants need one of them (by id, or matched from size/colour);
      // products without any never accept a variant.
      const options = toOptions(product.variants ?? []);
      let chosen: ProductVariantOption | undefined;
      if (options.length) {
        if (args.data.variantId) chosen = options.find((option) => option.variantId === args.data.variantId);
        else {
          const match = matchVariantIn(options, wishFrom(args.data.variantAttributes));
          if (match.kind === 'match') chosen = match.variant;
        }
        if (!chosen) {
          return { ok: false, error: 'Choose one of the listed sizes/colours; no cart item was added.', options: options.map(({ variantId, label, stock }) => ({ variantId, label, stock })) };
        }
      } else if (args.data.variantId || Object.keys(args.data.variantAttributes).length > 0) {
        return { ok: false, error: 'This product has no recorded variants; no cart item was added.' };
      }
      const available = chosen ? chosen.stock : product.stock;
      const currentCart = scopedCart(context, await cartService.getCart(buyerUserId));
      const currentQuantity = currentCart.sellerGroups.flatMap((group) => group.items)
        .find((item) => item.productId === product.publicId && (item.variantId ?? null) === (chosen?.variantId ?? null))?.quantity ?? 0;
      if (args.data.quantity + currentQuantity > available) {
        return { ok: false, error: 'Requested quantity exceeds the current stock.', availableStock: available };
      }
      const updatedCart = chosen
        ? await cartService.addCartItem(buyerUserId, product.publicId, args.data.quantity, chosen.variantId)
        : await cartService.addCartItem(buyerUserId, product.publicId, args.data.quantity);
      return { ok: true, cart: scopedCart(context, updatedCart), addedProductId: product.publicId, quantityAdded: args.data.quantity, ...(chosen ? { variantLabel: chosen.label } : {}) };
    }
    case 'check_cart': {
      if (!noArgsSchema.safeParse(toolCall.payload).success) return { ok: false, error: 'Invalid cart request.' };
      if (!buyerUserId) return { ok: false, error: 'Sign in as a buyer to view your saved cart.' };
      return scopedCart(context, await cartService.getCart(buyerUserId));
    }
    case 'remove_from_cart':
    case 'update_cart_quantity': {
      const args = toolCall.type === 'remove_from_cart'
        ? productSchema.safeParse(toolCall.payload)
        : quantitySchema.safeParse(toolCall.payload);
      if (!args.success) return { ok: false, error: 'Invalid cart request.' };
      if (!buyerUserId) return { ok: false, error: 'Sign in as a buyer to change your saved cart.' };
      // Only an item of this store that is already in the buyer's own cart can be changed.
      const cartItem = scopedCart(context, await cartService.getCart(buyerUserId)).sellerGroups
        .flatMap((group) => group.items).find((item) => item.productId === args.data.productId);
      if (!cartItem) return { ok: false, error: 'That product is not in your cart for this store.' };
      if (toolCall.type === 'remove_from_cart') {
        const updatedCart = await cartService.removeCartItem(buyerUserId, BigInt(cartItem.id));
        return { ok: true, cart: scopedCart(context, updatedCart), removedProductId: args.data.productId };
      }
      const quantity = (args.data as z.infer<typeof quantitySchema>).quantity;
      const product = await findStoreProduct(context.storeId, args.data.productId);
      if (!product) return { ok: false, error: 'Product not found in this store; the cart was not changed.' };
      if (quantity > product.stock) {
        return { ok: false, error: 'Requested quantity exceeds the current stock.', availableStock: product.stock };
      }
      const updatedCart = await cartService.updateCartItemQuantity(buyerUserId, BigInt(cartItem.id), quantity);
      return { ok: true, cart: scopedCart(context, updatedCart), productId: args.data.productId, quantity };
    }
    case 'get_store_policy': {
      const args = policySchema.safeParse(toolCall.payload);
      if (!args.success) return { ok: false, error: 'Invalid policy request.' };
      return { configured: false, topic: args.data.topic, message: `No store-specific ${args.data.topic} policy is configured.` };
    }
    case 'redirect_checkout':
      if (!noArgsSchema.safeParse(toolCall.payload).success) return { ok: false, error: 'Invalid checkout request.' };
      return { signal: 'redirect_checkout' };
    default:
      return { ok: false, error: 'Unsupported tool. No action was performed.' };
  }
}

function toOptions(variants: Array<{ variantId: bigint; size: string | null; color: string | null; stock: number }>): ProductVariantOption[] {
  return variants.map((variant) => ({
    variantId: variant.variantId.toString(),
    label: variantLabel(variant),
    attributes: { size: normaliseOption(variant.size), color: normaliseOption(variant.color) },
    stock: variant.stock,
  }));
}

function wishFrom(attributes: Record<string, unknown>): VariantWish {
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);
  return { size: text(attributes.size), color: text(attributes.color ?? attributes.colour) };
}
