jest.mock('../../src/modules/chatbot/product-variant.adapter', () => ({
  ...jest.requireActual('../../src/modules/chatbot/product-variant.adapter'),
  listProductVariants: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../src/modules/chatbot/product-search.service', () => ({
  ...jest.requireActual('../../src/modules/chatbot/product-search.service'),
  searchCatalog: jest.fn(),
  findStoreItems: jest.fn(),
}));

import { findStoreItems, searchCatalog, type CatalogItem } from '../../src/modules/chatbot/product-search.service';
import { listProductVariants } from '../../src/modules/chatbot/product-variant.adapter';
import { handleShoppingMessage, type ShoppingContext, type ShoppingState } from '../../src/modules/chatbot/buyer-shopping.service';

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const shirts: CatalogItem[] = [
  { productId: ID(1), titleEn: 'Black Cotton Shirt', price: '1500', stock: 4, category: 'Shirts' },
  { productId: ID(2), titleEn: 'White Linen Shirt', price: '1200', stock: 2, category: 'Shirts' },
  { productId: ID(3), titleEn: 'Blue Denim Shirt', price: '2200', stock: 0, category: 'Shirts' },
];
const listed: ShoppingState = { refs: shirts.map((item) => item.productId), offset: 0, total: 3, page: 0, spec: { terms: ['shirts'], stock: 'any' } };

function context(state: ShoppingState | null = null, toolResult: unknown = { ok: true, quantityAdded: 1 }) {
  const runTool = jest.fn().mockResolvedValue(toolResult);
  const ctx: ShoppingContext = { storeId: 7n, storeName: 'Zainab Fashion House', state, runTool };
  return { ctx, runTool };
}

describe('buyer shopping flow', () => {
  beforeEach(() => {
    jest.mocked(searchCatalog).mockReset().mockResolvedValue({ items: shirts, total: 3 });
    jest.mocked(findStoreItems).mockReset().mockImplementation(async (_store, ids) =>
      ids.map((id) => shirts.find((item) => item.productId === id)).filter((item): item is CatalogItem => Boolean(item)));
  });

  it('lists matching products from the database with numbers, prices and stock', async () => {
    const { ctx, runTool } = context();
    const outcome = await handleShoppingMessage(ctx, 'Show me shirts');
    expect(searchCatalog).toHaveBeenCalledWith(7n, expect.objectContaining({ terms: ['shirts'] }), 0);
    expect(outcome?.reply).toContain('#1 Black Cotton Shirt — Rs. 1,500 · 4 in stock · Shirts');
    expect(outcome?.reply).toContain('#3 Blue Denim Shirt — Rs. 2,200 · out of stock');
    expect(outcome?.state?.refs).toEqual(listed.refs);
    expect(runTool).not.toHaveBeenCalled();
  });

  it('answers in Roman Urdu and says how many more remain', async () => {
    jest.mocked(searchCatalog).mockResolvedValue({ items: shirts, total: 11 });
    const outcome = await handleShoppingMessage(context().ctx, 'Shirts dikhao');
    expect(outcome?.reply).toContain('11 products mile');
    expect(outcome?.reply).toContain('8 aur hain');
  });

  it('pages forward with the same filters on "aur dikhao"', async () => {
    await handleShoppingMessage(context(listed).ctx, 'Aur dikhao');
    expect(searchCatalog).toHaveBeenCalledWith(7n, listed.spec, 1);
  });

  it('says plainly when nothing matches instead of inventing products', async () => {
    jest.mocked(searchCatalog).mockResolvedValue({ items: [], total: 0 });
    const outcome = await handleShoppingMessage(context().ctx, 'Show me jackets');
    expect(outcome?.reply).toContain("couldn't find any live products");
    expect(outcome?.state).toBeNull();
  });

  it('adds the second listed product with the requested quantity through the cart tool', async () => {
    const { ctx, runTool } = context(listed, { ok: true, quantityAdded: 2 });
    const outcome = await handleShoppingMessage(ctx, 'Doosra product cart mein 2 quantity ke sath add karo');
    expect(runTool).toHaveBeenCalledTimes(1);
    expect(runTool).toHaveBeenCalledWith({ type: 'add_to_cart', payload: { productId: ID(2), quantity: 2, variantAttributes: {} } });
    expect(outcome?.reply).toContain('2 × White Linen Shirt cart mein add ho gaya');
    expect(outcome?.cartChanged).toBe(true);
  });

  it('adds the cheapest shown product', async () => {
    const { ctx, runTool } = context(listed);
    await handleShoppingMessage(ctx, 'Sasta wala add kar do');
    expect(runTool).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ productId: ID(2) }) }));
  });

  it('filters the shown list by a word ("is mein se black wala")', async () => {
    const { ctx, runTool } = context(listed);
    await handleShoppingMessage(ctx, 'Is mein se black wala add kar do');
    expect(runTool).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ productId: ID(1) }) }));
  });

  it('never claims success when the cart tool refuses', async () => {
    const { ctx } = context(listed, { ok: false, error: 'Sign in as a buyer before adding products to the saved cart.' });
    const outcome = await handleShoppingMessage(ctx, 'add #1');
    expect(outcome?.reply).toContain('Sign in as a buyer');
    expect(outcome?.reply).toContain('Nothing was added');
    expect(outcome?.cartChanged).toBe(false);
  });

  it('reports real availability when the quantity is more than the stock', async () => {
    const { ctx } = context(listed, { ok: false, error: 'Requested quantity exceeds the current stock.', availableStock: 4 });
    const outcome = await handleShoppingMessage(ctx, 'add 9 of the first product');
    expect(outcome?.reply).toContain('Only 4 of Black Cotton Shirt');
    expect(outcome?.reply).toContain('Nothing was added');
  });

  it('does not call the cart for an out-of-stock product', async () => {
    const { ctx, runTool } = context(listed);
    const outcome = await handleShoppingMessage(ctx, 'add #3');
    expect(runTool).not.toHaveBeenCalled();
    expect(outcome?.reply).toContain('out of stock');
  });

  it('asks which product when "two shirts" matches several, and changes nothing', async () => {
    const { ctx, runTool } = context(listed);
    const outcome = await handleShoppingMessage(ctx, 'Add two shirts to my cart');
    expect(runTool).not.toHaveBeenCalled();
    expect(outcome?.reply).toContain('Which one do you mean?');
    expect(outcome?.reply).toContain('Nothing was changed');
  });

  it('asks for a product when "this" has nothing to refer to', async () => {
    const { ctx, runTool } = context(null);
    const outcome = await handleShoppingMessage(ctx, 'Add this product to my cart');
    expect(runTool).not.toHaveBeenCalled();
    expect(outcome?.reply).toContain('Which product do you mean?');
  });

  it('refuses an unrecorded size instead of adding the plain product', async () => {
    const { ctx, runTool } = context({ ...listed, focus: ID(2) });
    const outcome = await handleShoppingMessage(ctx, 'Is shirt ko medium size mein add karo');
    expect(runTool).not.toHaveBeenCalled();
    expect(outcome?.reply).toContain('size/colour options record nahi');
    expect(outcome?.reply).toContain('Kuch add nahi hua');
  });

  it('asks which shirt first when a size is requested for several matches', async () => {
    const { ctx, runTool } = context(listed);
    const outcome = await handleShoppingMessage(ctx, 'Medium size ki 2 shirts add karo');
    expect(runTool).not.toHaveBeenCalled();
    expect(outcome?.reply).toContain('Inn mein se kaunsa?');
  });

  it('accepts a colour that is part of the listing title', async () => {
    const { ctx, runTool } = context(listed);
    await handleShoppingMessage(ctx, 'Ek black shirt cart mein add karo');
    expect(runTool).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ productId: ID(1), quantity: 1 }) }));
  });

  it('answers price and stock follow-ups from the database row', async () => {
    const focused = { ...listed, focus: ID(1) };
    expect((await handleShoppingMessage(context(focused).ctx, 'Iski price kya hai?'))?.reply).toBe('Black Cotton Shirt ki price Rs. 1,500 hai (4 stock mein).');
    expect((await handleShoppingMessage(context(focused).ctx, 'How many pieces are available?'))?.reply).toContain('4 units in stock');
  });

  it('names the cheapest of the shown list', async () => {
    const outcome = await handleShoppingMessage(context(listed).ctx, 'In mein se sasta kaunsa hai?');
    expect(outcome?.reply).toContain('#2 White Linen Shirt');
    expect(outcome?.state?.focus).toBe(ID(2));
  });

  it('removes and re-quantifies only through the cart tools', async () => {
    const { ctx, runTool } = context({ ...listed, focus: ID(1) }, { ok: true });
    await handleShoppingMessage(ctx, 'Is product ko cart se hata do');
    expect(runTool).toHaveBeenCalledWith({ type: 'remove_from_cart', payload: { productId: ID(1) } });
    await handleShoppingMessage(ctx, 'Quantity 3 kar do');
    expect(runTool).toHaveBeenCalledWith({ type: 'update_cart_quantity', payload: { productId: ID(1), quantity: 3 } });
  });

  it('shows the cart for this store', async () => {
    const { ctx } = context(null, { sellerGroups: [{ subtotal: '3000.00', items: [{ productId: ID(1), titleEn: 'Black Cotton Shirt', quantity: 2, price: '1500', lineSubtotal: '3000.00' }] }] });
    const outcome = await handleShoppingMessage(ctx, 'Mera cart dikhao');
    expect(outcome?.reply).toContain('Black Cotton Shirt × 2 — Rs. 3,000');
  });

  it('greets locally and answers a salam', async () => {
    expect((await handleShoppingMessage(context().ctx, 'Assalam o alaikum'))?.reply).toContain('Zainab Fashion House');
    const outcome = await handleShoppingMessage(context().ctx, 'Assalam o alaikum, mujhe shirts chahiye');
    expect(outcome?.reply.startsWith('Wa alaikum assalam!')).toBe(true);
    expect(searchCatalog).toHaveBeenCalled();
  });

  it('returns null for questions it should leave to the model', async () => {
    expect(await handleShoppingMessage(context().ctx, 'What is your return policy?')).toBeNull();
  });

  describe('with recorded variants', () => {
    const options = [
      { variantId: '11', label: 'M / Black', attributes: { size: 'medium', color: 'black' }, stock: 3 },
      { variantId: '12', label: 'L / Black', attributes: { size: 'large', color: 'black' }, stock: 0 },
    ];
    beforeEach(() => jest.mocked(listProductVariants).mockResolvedValue(options));
    afterEach(() => jest.mocked(listProductVariants).mockResolvedValue([]));

    it('asks which size when none is given, and adds nothing', async () => {
      const { ctx, runTool } = context({ ...listed, focus: ID(1) });
      const outcome = await handleShoppingMessage(ctx, 'Add this product to my cart');
      expect(runTool).not.toHaveBeenCalled();
      expect(outcome?.reply).toContain('- M / Black — 3 in stock');
      expect(outcome?.reply).toContain('Nothing was added');
    });

    it('adds the matching variant by size', async () => {
      const { ctx, runTool } = context({ ...listed, focus: ID(1) }, { ok: true, quantityAdded: 2 });
      const outcome = await handleShoppingMessage(ctx, 'Is product ke 2 pieces medium size mein add karo');
      expect(runTool).toHaveBeenCalledWith({ type: 'add_to_cart', payload: { productId: ID(1), quantity: 2, variantAttributes: {}, variantId: '11' } });
      expect(outcome?.reply).toContain('Black Cotton Shirt (M / Black)');
    });

    it('refuses an out-of-stock variant without calling the cart', async () => {
      const { ctx, runTool } = context({ ...listed, focus: ID(1) });
      const outcome = await handleShoppingMessage(ctx, 'Add this in large size');
      expect(runTool).not.toHaveBeenCalled();
      expect(outcome?.reply).toContain('out of stock');
    });

    it('lists each option with its own stock for a stock question', async () => {
      const outcome = await handleShoppingMessage(context({ ...listed, focus: ID(1) }).ctx, 'How many pieces are available?');
      expect(outcome?.reply).toContain('- L / Black — out of stock');
    });
  });
});
