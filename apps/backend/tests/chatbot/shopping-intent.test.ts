import { parseShoppingMessage } from '../../src/modules/chatbot/shopping-intent';

const intentOf = (message: string) => parseShoppingMessage(message).intent;

describe('shopping intent parser (English, Roman Urdu, mixed)', () => {
  it.each([
    'What products are available in this store?',
    'Is store mein kaun kaun se products hain?',
    'Show me all products in this store.',
    'Sare products dikhao',
    'List all available items.',
    'Sare available products dikhao.',
  ])('lists the catalog: %s', (message) => {
    const intent = intentOf(message);
    expect(intent).toMatchObject({ type: 'search', explicit: true, spec: { terms: [] } });
  });

  it.each([
    ["What's in stock right now?", 'in'],
    ['Abhi stock mein kya kya hai?', 'in'],
    ['Which products are out of stock?', 'out'],
    ['Out of stock products dikhao', 'out'],
    ['Jo products out of stock hain woh dikhao', 'out'],
  ])('reads the stock filter: %s', (message, stock) => {
    expect(intentOf(message)).toMatchObject({ type: 'search', spec: { terms: [], stock } });
  });

  it.each([
    ['Show me shirts.', ['shirts']],
    ['Shirts dikhao', ['shirts']],
    ['Kaun kaun si shirts available hain?', ['shirts']],
    ['Find all pants in this store.', ['pants']],
    ['Pants wale products dikhao', ['pants']],
    ['Show me shoes.', ['shoes']],
    ['Shoes hain aap ke paas?', ['shoes']],
    ['Joote dikhao', ['shoe']],
    ['Find cotton shirts', ['cotton', 'shirts']],
    ['Cotton wali shirts dikhao', ['cotton', 'shirts']],
    ['Find products related to jackets', ['jackets']],
    ['Jackets dhoond do', ['jackets']],
    ["Find products with the word 'shirt' in the name", ['shirt']],
  ])('extracts search words: %s', (message, terms) => {
    expect(intentOf(message)).toMatchObject({ type: 'search', explicit: true, spec: { terms } });
  });

  it.each([
    ['Show products under Rs. 2000', { maxPrice: 2000 }],
    ['2000 se kam price wale products dikhao', { maxPrice: 2000 }],
    ['Which products are available between Rs. 500 and Rs. 1500?', { minPrice: 500, maxPrice: 1500 }],
    ['500 se 1500 tak ke products dikhao', { minPrice: 500, maxPrice: 1500 }],
    ['Products above 3,000 dikhao', { minPrice: 3000 }],
  ])('extracts price ranges: %s', (message, price) => {
    expect(intentOf(message)).toMatchObject({ type: 'search', spec: price });
  });

  it.each(['Show more products', 'Aur products dikhao', 'Show the next page', 'Agle products dikhao', 'Thanks, aur options dikhao'])(
    'asks for the next page: %s', (message) => {
      expect(intentOf(message)).toMatchObject({ type: 'more' });
    },
  );

  it.each([
    ['What is the price of this shirt?', 'price', { kind: 'this' }],
    ['Is shirt ki price kya hai?', 'price', { kind: 'this' }],
    ['Iski price kya hai?', 'price', { kind: 'this' }],
    ['How many pieces are available?', 'stock', { kind: 'this' }],
    ['Kitne pieces stock mein hain?', 'stock', { kind: 'this' }],
    ['What is the price of the second product?', 'price', { kind: 'ordinal', index: 2 }],
    ['Is it available?', 'availability', { kind: 'this' }],
  ])('asks about a shown product: %s', (message, ask, ref) => {
    expect(intentOf(message)).toMatchObject({ type: 'detail', ask, ref });
  });

  it.each(['Is it available in medium?', 'Medium size available hai?'])('asks for a size: %s', (message) => {
    expect(intentOf(message)).toMatchObject({ type: 'detail', variant: { size: 'medium' } });
  });

  it.each(['Which one is cheaper?', 'In mein se sasta kaunsa hai?', 'In mein se sab se sasta kaunsa hai?'])(
    'compares the shown list: %s', (message) => {
      expect(intentOf(message)).toMatchObject({ type: 'cheapest_of_list', highest: false });
    },
  );

  it.each([
    ['Add this product to my cart', { kind: 'this' }, 1],
    ['Is product ko cart mein add kar do', { kind: 'this' }, 1],
    ['Add 3 units of this product', { kind: 'this' }, 3],
    ['Is product ke 3 pieces add kar do', { kind: 'this' }, 3],
    ['Add the second product, quantity 2', { kind: 'ordinal', index: 2 }, 2],
    ['Doosra product cart mein 2 quantity ke sath add karo', { kind: 'ordinal', index: 2 }, 2],
    ['Add 2 of the first product', { kind: 'ordinal', index: 1 }, 2],
    ['Pehle product ke 2 pieces add karo', { kind: 'ordinal', index: 1 }, 2],
    ['Pehle wale ke 2 pieces add karo', { kind: 'ordinal', index: 1 }, 2],
    ['add #3', { kind: 'ordinal', index: 3, label: true }, 1],
    ['#3 ke 2 pieces add karo', { kind: 'ordinal', index: 3, label: true }, 2],
    ['Add the cheaper one', { kind: 'cheapest' }, 1],
    ['Sasta wala add kar do', { kind: 'cheapest' }, 1],
    ['Jo sasta wala hai usko add karo', { kind: 'cheapest' }, 1],
    ['Add two shirts to my cart', { kind: 'name', terms: ['shirts'] }, 2],
    ['Do shirts cart mein add karo', { kind: 'name', terms: ['shirts'] }, 2],
    ['Do shirts mere cart mein add kar do', { kind: 'name', terms: ['shirts'] }, 2],
    ['Add this one', { kind: 'this' }, 1],
  ])('adds to cart: %s', (message, ref, quantity) => {
    expect(intentOf(message)).toMatchObject({ type: 'add', ref, quantity });
  });

  it.each([
    ['Add the black medium shirt', { size: 'medium', color: 'black' }],
    ['Black medium shirt add karo', { size: 'medium', color: 'black' }],
    ['Medium size ki 2 shirts add karo', { size: 'medium' }],
    ['Ek black shirt cart mein add karo', { color: 'black' }],
  ])('keeps the requested variant: %s', (message, variant) => {
    expect(intentOf(message)).toMatchObject({ type: 'add', variant });
  });

  it('treats "is mein se black wala" as a name filter on the shown list', () => {
    expect(intentOf('Is mein se black wala add kar do')).toMatchObject({ type: 'add', ref: { kind: 'name', terms: ['black'] }, quantity: 1 });
  });

  it.each([
    ['Show my cart', { type: 'show_cart' }],
    ['Mera cart dikhao', { type: 'show_cart' }],
    ['Remove this product from my cart', { type: 'remove', ref: { kind: 'this' } }],
    ['Is product ko cart se hata do', { type: 'remove', ref: { kind: 'this' } }],
    ['Increase quantity to 3', { type: 'set_quantity', quantity: 3 }],
    ['Quantity 3 kar do', { type: 'set_quantity', quantity: 3 }],
  ])('handles cart requests: %s', (message, intent) => {
    expect(intentOf(message)).toMatchObject(intent);
  });

  it.each([
    ['Show me similar products from this store.', 'similar'],
    ['Show me more like this', 'similar'],
  ])('finds similar items: %s', (message, type) => {
    expect(intentOf(message)).toMatchObject({ type });
  });

  it.each([
    ['Hello', 'greeting'], ['Hi, can you help me?', 'help'], ['Assalam o alaikum', 'greeting'],
    ['Thank you', 'thanks'], ['Aap kya kar sakte ho?', 'help'], ['How can you help me?', 'help'],
  ])('handles conversation locally: %s', (message, type) => {
    expect(intentOf(message)).toMatchObject({ type });
  });

  it('keeps the request after a salam and answers in Roman Urdu', () => {
    const parsed = parseShoppingMessage('Assalam o alaikum, mujhe shirts chahiye');
    expect(parsed).toMatchObject({ salam: true, lang: 'roman', intent: { type: 'search', spec: { terms: ['shirts'] } } });
  });

  it('understands a mixed request with price and size', () => {
    expect(intentOf('I want a shirt under 1500, medium size mein')).toMatchObject({
      type: 'search', spec: { terms: ['shirt'], maxPrice: 1500 }, variant: { size: 'medium' },
    });
  });

  it('reads a quantity and colour from a mixed request without adding anything', () => {
    expect(intentOf('Mujhe 2 black shirts chahiye, agar available hain')).toMatchObject({ type: 'search', spec: { terms: expect.arrayContaining(['black', 'shirts']) } });
  });

  it.each(['Salam, mujhe product chahiye', 'Mujhe product chahiye'])('treats a vague want as a catalog listing: %s', (message) => {
    expect(intentOf(message)).toMatchObject({ type: 'search', spec: { terms: [] } });
  });

  it.each(['What is your return policy?', 'Do you deliver to Lahore?', 'Is cash on delivery available?', 'Why is the sky blue and why do birds sing in the morning'])(
    'leaves policy and open questions to the model: %s', (message) => {
      expect(intentOf(message)).toBeNull();
    },
  );

  it.each([['Show me shirts', 'en'], ['Shirts dikhao', 'roman'], ['Kitne pieces available hain?', 'roman']])('detects the reply language: %s', (message, lang) => {
    expect(parseShoppingMessage(message).lang).toBe(lang);
  });

  it('never reads "kar do" as a quantity of two', () => {
    expect(intentOf('Is product ko cart mein add kar do')).toMatchObject({ quantity: 1 });
  });
});
