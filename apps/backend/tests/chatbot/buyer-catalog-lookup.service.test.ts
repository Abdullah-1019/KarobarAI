jest.mock('../../src/core/prisma', () => ({ prisma: { product: { findMany: jest.fn() } } }));

import { prisma } from '../../src/core/prisma';
import { getCatalogReply, resolveCartRequest } from '../../src/modules/chatbot/buyer-catalog-lookup.service';

const catalog = [
  { publicId: 'sugar', titleEn: 'White Sugar - 1 kg', price: '210', stock: 15 },
  { publicId: 'tea-black', titleEn: 'Black Tea - 250 g', price: '650', stock: 11 },
  { publicId: 'tea-green', titleEn: 'Green Tea - 100 g', price: '490', stock: 4 },
  { publicId: 'turmeric', titleEn: 'Turmeric Powder - 100 g', price: '190', stock: 6 },
  { publicId: 'cumin', titleEn: 'Cumin Seeds - 100 g', price: '260', stock: 9 },
  { publicId: 'clips', titleEn: 'Hair Clips - 6 Pack', price: '350', stock: 12 },
];

describe('buyer catalog lookup', () => {
  beforeEach(() => {
    jest.mocked(prisma.product.findMany).mockReset().mockResolvedValue(catalog as never);
  });

  it.each(['i want to buy white suger', 'i want to buy sugar'])(
    'matches a sugar purchase inquiry without offering unrelated items: %s', async (message) => {
      const reply = await getCatalogReply(41n, message, 'en');
      expect(reply).toContain('White Sugar - 1 kg');
      expect(reply).toContain('Rs. 210 (15 in stock)');
      expect(reply).not.toContain('Turmeric');
      expect(reply).not.toContain('Cumin');
      expect(reply).toContain('have not added anything to your cart or placed an order');
    },
  );

  it('handles two products and a spelling slip independently', async () => {
    const reply = await getCatalogReply(41n, 'i want to purchase black tea and white suger', 'en');
    expect(reply).toContain('Black Tea - 250 g');
    expect(reply).toContain('White Sugar - 1 kg');
    expect(reply).toContain('Did you mean');
    expect(reply).not.toContain('Turmeric');
    expect(reply).not.toContain('Cumin');
  });

  it('handles a bare two-product request without sending it to the scope guard', async () => {
    const reply = await getCatalogReply(41n, 'black tea and white sugar', 'en');
    expect(reply).toContain('Black Tea - 250 g');
    expect(reply).toContain('White Sugar - 1 kg');
    expect(reply).not.toContain('Turmeric');
  });

  it('reports unavailable stock from the catalog instead of claiming availability', async () => {
    jest.mocked(prisma.product.findMany).mockResolvedValue([
      { publicId: 'tea-black', titleEn: 'Black Tea - 250 g', price: '650', stock: 0 },
    ] as never);
    const reply = await getCatalogReply(41n, 'black tea', 'en');
    expect(reply).toContain('currently out of stock');
    expect(reply).not.toContain('in stock');
  });

  it('lists every matching tea title in the bounded candidate set', async () => {
    const reply = await getCatalogReply(41n, 'tea?', 'en');
    expect(reply).toContain('Black Tea - 250 g');
    expect(reply).toContain('Green Tea - 100 g');
    expect(reply).not.toContain('White Sugar');
  });

  it('answers an availability question using the matching listing', async () => {
    const reply = await getCatalogReply(41n, 'is black tea available?', 'en');
    expect(reply).toContain('Black Tea - 250 g');
    expect(reply).not.toContain('Green Tea - 100 g');
  });

  it('handles short follow-ups and singular/plural product names', async () => {
    const reply = await getCatalogReply(41n, 'and hair clip', 'en');
    expect(reply).toContain('Hair Clips - 6 Pack');
  });

  it('keeps the store, LIVE status, and soft-delete filters inside the catalog query', async () => {
    await getCatalogReply(41n, 'black tea', 'en');
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ sellerId: 41n, status: 'LIVE', deletedAt: null }),
      take: 200,
    }));
  });

  it('never treats an add-to-cart command as a read-only catalog request', async () => {
    expect(await getCatalogReply(41n, 'add black tea to cart', 'en')).toBeNull();
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('resolves one exact cart item from the current store without using a model-supplied ID', async () => {
    const lookup = await resolveCartRequest(41n, 'add 1 white sugar to cart');
    expect(lookup).toEqual({ kind: 'product', productId: 'sugar', titleEn: 'White Sugar - 1 kg', quantity: 1 });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ sellerId: 41n, status: 'LIVE', deletedAt: null }),
    }));
  });

  it('requires confirmation before mutating for ambiguous or misspelled cart products', async () => {
    expect(await resolveCartRequest(41n, 'add tea to cart')).toMatchObject({ kind: 'clarify' });
    expect(await resolveCartRequest(41n, 'add 1 white suger to cart')).toMatchObject({ kind: 'clarify' });
  });
});
