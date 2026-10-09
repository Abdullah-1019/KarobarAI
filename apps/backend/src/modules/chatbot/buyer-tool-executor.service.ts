import axios from 'axios';
import { z } from 'zod';

import { config } from '../../core/config';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import * as cartService from '../cart/cart.service';
import { retrieveRelevantProducts } from './rag.service';
import type { BuyerStoreContext } from './buyer-context-builder.service';
import type { ChatToolDefinition, ToolCall } from './slm-client';

const searchSchema = z.object({ query: z.string().trim().min(2).max(300) }).strict();
const productSchema = z.object({ productId: z.string().uuid() }).strict();
const variantSchema = z.object({
  productId: z.string().uuid(),
  variantAttributes: z.record(z.string(), z.unknown()),
}).strict();
const addSchema = variantSchema.extend({ quantity: z.number().int().min(1).max(99) }).strict();
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
    variants: [],
  };
}

async function findStoreProduct(storeId: bigint, productPublicId: string) {
  const product = await prisma.product.findFirst({
    where: { publicId: productPublicId, sellerId: storeId, status: 'LIVE', deletedAt: null },
    include: { category: { select: { slug: true, nameEn: true, nameUr: true } }, images: { where: { position: 0 }, take: 1 } },
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

export async function executeBuyerTool(context: BuyerStoreContext, buyerUserId: bigint | undefined, toolCall: ToolCall): Promise<unknown> {
  switch (toolCall.type) {
    case 'search_products': {
      const args = searchSchema.safeParse(toolCall.payload);
      if (!args.success) return { ok: false, error: 'Invalid search request.' };
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
      // Product and cart schemas currently have no variant model. Do not infer or accept
      // unrecorded options; an empty selection is the only safe representation.
      if (Object.keys(args.data.variantAttributes).length > 0) {
        return { ok: false, error: 'This product has no recorded variants. Ask the buyer to choose another listed product.' };
      }
      return { ok: true, productId: product.publicId, variantAttributes: {} };
    }
    case 'add_to_cart': {
      const args = addSchema.safeParse(toolCall.payload);
      if (!args.success) return { ok: false, error: 'Invalid cart request.' };
      if (!buyerUserId) return { ok: false, error: 'Sign in as a buyer before adding products to the saved cart.' };
      if (Object.keys(args.data.variantAttributes).length > 0) {
        return { ok: false, error: 'This product has no recorded variants; no cart item was added.' };
      }
      const product = await findStoreProduct(context.storeId, args.data.productId);
      if (!product) return { ok: false, error: 'Product not found in this store; no cart item was added.' };
      const currentCart = scopedCart(context, await cartService.getCart(buyerUserId));
      const currentQuantity = currentCart.sellerGroups.flatMap((group) => group.items)
        .find((item) => item.productId === product.publicId)?.quantity ?? 0;
      if (args.data.quantity + currentQuantity > product.stock) {
        return { ok: false, error: 'Requested quantity exceeds the current stock.', availableStock: product.stock };
      }
      const updatedCart = await cartService.addCartItem(buyerUserId, product.publicId, args.data.quantity);
      return { ok: true, cart: scopedCart(context, updatedCart), addedProductId: product.publicId, quantityAdded: args.data.quantity };
    }
    case 'check_cart': {
      if (!noArgsSchema.safeParse(toolCall.payload).success) return { ok: false, error: 'Invalid cart request.' };
      if (!buyerUserId) return { ok: false, error: 'Sign in as a buyer to view your saved cart.' };
      return scopedCart(context, await cartService.getCart(buyerUserId));
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
