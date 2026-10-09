jest.mock('../../src/core/prisma', () => ({ prisma: { product: { findFirst: jest.fn() } } }));
jest.mock('../../src/core/config', () => ({ config: { aiServiceUrl: 'http://ai-service:8000' } }));
jest.mock('../../src/core/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('../../src/modules/cart/cart.service', () => ({ getCart: jest.fn(), addCartItem: jest.fn() }));
jest.mock('../../src/modules/chatbot/rag.service', () => ({ retrieveRelevantProducts: jest.fn() }));
jest.mock('axios', () => ({ post: jest.fn() }));

import axios from 'axios';
import { prisma } from '../../src/core/prisma';
import * as cartService from '../../src/modules/cart/cart.service';
import { executeBuyerTool } from '../../src/modules/chatbot/buyer-tool-executor.service';
import type { BuyerStoreContext } from '../../src/modules/chatbot/buyer-context-builder.service';
import { retrieveRelevantProducts } from '../../src/modules/chatbot/rag.service';

const context = {
  storeId: 41n,
  store: {
    slug: 'sample-store-seller-id', publicId: 'seller-public-id', name: 'Sample Store',
    description: null, logoUrl: null, bannerUrl: null,
    policies: { returns: null, shipping: null, payment: null },
  },
  cart: null,
} as unknown as BuyerStoreContext;

const product = {
  publicId: '11111111-1111-4111-8111-111111111111',
  sellerId: 41n,
  titleEn: 'Blue shirt', titleUr: null, descriptionEn: 'Cotton shirt', descriptionUr: null,
  price: { toString: () => '1800.00' }, stock: 3, status: 'LIVE', tags: ['blue'],
  category: null, images: [],
};

describe('buyer tool executor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(axios.post).mockResolvedValue({ data: { embeddings: [Array(768).fill(0.1)] } });
  });

  it('sends search embeddings to same-store RAG retrieval', async () => {
    jest.mocked(retrieveRelevantProducts).mockResolvedValue([product] as never);
    const result = await executeBuyerTool(context, undefined, {
      type: 'search_products', payload: { query: 'blue shirt' },
    });
    expect(axios.post).toHaveBeenCalledWith('http://ai-service:8000/internal/embeddings', { texts: ['blue shirt'] }, expect.any(Object));
    expect(retrieveRelevantProducts).toHaveBeenCalledWith(41n, expect.any(Array), 8);
    expect(result).toEqual([expect.objectContaining({ titleEn: 'Blue shirt', price: '1800.00', stock: 3 })]);
  });

  it('rejects a product from another store before any cart mutation', async () => {
    jest.mocked(prisma.product.findFirst).mockResolvedValue(null);
    const result = await executeBuyerTool(context, 9n, {
      type: 'add_to_cart', payload: { productId: product.publicId, variantAttributes: {}, quantity: 1 },
    });
    expect(prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { publicId: product.publicId, sellerId: 41n, status: 'LIVE', deletedAt: null },
    }));
    expect(cartService.addCartItem).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false });
  });

  it('adds a validated, in-stock item using the existing CartService', async () => {
    jest.mocked(prisma.product.findFirst).mockResolvedValue(product as never);
    const emptyCart = { sellerGroups: [], grandSubtotal: '0.00' };
    jest.mocked(cartService.getCart).mockResolvedValue(emptyCart as never);
    jest.mocked(cartService.addCartItem).mockResolvedValue(emptyCart as never);
    const result = await executeBuyerTool(context, 9n, {
      type: 'add_to_cart', payload: { productId: product.publicId, variantAttributes: {}, quantity: 2 },
    });
    expect(cartService.addCartItem).toHaveBeenCalledWith(9n, product.publicId, 2);
    expect(result).toMatchObject({ ok: true, addedProductId: product.publicId, quantityAdded: 2 });
  });

  it('does not mutate when requested quantity exceeds confirmed stock', async () => {
    jest.mocked(prisma.product.findFirst).mockResolvedValue(product as never);
    jest.mocked(cartService.getCart).mockResolvedValue({ sellerGroups: [], grandSubtotal: '0.00' } as never);
    const result = await executeBuyerTool(context, 9n, {
      type: 'add_to_cart', payload: { productId: product.publicId, variantAttributes: {}, quantity: 4 },
    });
    expect(cartService.addCartItem).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, availableStock: 3 });
  });

  it('fails closed for unknown tools and unrecorded variants', async () => {
    jest.mocked(prisma.product.findFirst).mockResolvedValue(product as never);
    const unsupported = await executeBuyerTool(context, 9n, { type: 'charge_card', payload: {} });
    const variant = await executeBuyerTool(context, 9n, {
      type: 'select_variant', payload: { productId: product.publicId, variantAttributes: { color: 'red' } },
    });
    expect(unsupported).toMatchObject({ ok: false });
    expect(variant).toMatchObject({ ok: false });
    expect(cartService.addCartItem).not.toHaveBeenCalled();
  });
});
