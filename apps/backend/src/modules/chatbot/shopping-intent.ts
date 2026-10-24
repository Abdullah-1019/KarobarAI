import type { SearchSpec } from './product-search.service';
import type { VariantWish } from './product-variant.adapter';

// Deterministic understanding of common shopping messages in English, Roman Urdu and a mix of
// both. It only extracts structured intent; every fact and every action is then resolved against
// the database by buyer-shopping.service. Anything it does not recognise returns null and goes to
// the language model instead, so a miss here never produces a wrong answer by itself.

export type ReplyLang = 'en' | 'roman';

export type ProductRef =
  | { kind: 'ordinal'; index: number; label: boolean }
  | { kind: 'this' }
  | { kind: 'cheapest' }
  | { kind: 'priciest' }
  | { kind: 'name'; terms: string[] };

export type ShoppingIntent =
  | { type: 'greeting' }
  | { type: 'help' }
  | { type: 'thanks' }
  | { type: 'show_cart' }
  | { type: 'search'; spec: SearchSpec; explicit: boolean; variant: VariantWish }
  | { type: 'more'; terms: string[] }
  | { type: 'similar'; ref: ProductRef }
  | { type: 'cheapest_of_list'; highest: boolean }
  | { type: 'detail'; ref: ProductRef; ask: 'price' | 'stock' | 'availability'; variant: VariantWish }
  | { type: 'add'; ref: ProductRef; quantity: number; variant: VariantWish }
  | { type: 'remove'; ref: ProductRef }
  | { type: 'set_quantity'; ref: ProductRef; quantity: number };

export interface ParsedShoppingMessage {
  lang: ReplyLang;
  salam: boolean;
  greeted: boolean;
  intent: ShoppingIntent | null;
}

const ROMAN_MARKERS = new Set([
  'hai', 'hain', 'hy', 'mein', 'mujhe', 'muje', 'chahiye', 'chahie', 'dikhao', 'dikha', 'dikhaen', 'dikhayen', 'karo',
  'kar', 'kardo', 'kya', 'kia', 'kaun', 'kon', 'kaunsa', 'konsa', 'kaunsi', 'konsi', 'sasta', 'sasti', 'saste',
  'wala', 'wali', 'wale', 'aur', 'abhi', 'kitne', 'kitna', 'kitni', 'iski', 'iska', 'iske', 'isko', 'sare', 'saare',
  'sab', 'mera', 'meri', 'mere', 'pehla', 'pehle', 'pehli', 'doosra', 'dusra', 'doosre', 'dusre', 'teesra', 'hata',
  'hatao', 'nikal', 'nikalo', 'daal', 'daalo', 'dalo', 'dhoond', 'dhoondo', 'dhundo', 'paas', 'aap', 'se', 'ke',
  'ki', 'ka', 'ko', 'sath', 'saath', 'qeemat', 'keemat', 'kimat', 'milega', 'milegi', 'chahie', 'jo', 'woh', 'yeh',
  'agle', 'agla', 'shukriya', 'shukria', 'madad', 'sakte', 'sakta', 'baare', 'bare', 'kam', 'zyada', 'ziada',
]);

const NUMBER_WORDS: Record<string, number> = {
  one: 1, ek: 1, aik: 1, a: 1, an: 1, two: 2, three: 3, teen: 3, four: 4, char: 4, chaar: 4, five: 5,
  paanch: 5, panch: 5, six: 6, chhe: 6, chay: 6, seven: 7, saat: 7, eight: 8, aath: 8, nine: 9, nau: 9,
  ten: 10, das: 10,
};

const ORDINALS: Record<string, number> = {
  first: 1, '1st': 1, pehla: 1, pehle: 1, pehli: 1, pahla: 1, pahle: 1, second: 2, '2nd': 2, doosra: 2,
  dusra: 2, doosre: 2, dusre: 2, doosri: 2, dusri: 2, third: 3, '3rd': 3, teesra: 3, tisra: 3, teesre: 3,
  teesri: 3, fourth: 4, '4th': 4, chautha: 4, chotha: 4, chauthe: 4, chauthi: 4, fifth: 5, '5th': 5,
  paanchwa: 5, panchwa: 5, paanchwan: 5, last: -1, aakhri: -1, akhri: -1,
};

const COLORS: Record<string, string> = {
  black: 'black', kala: 'black', kaala: 'black', kali: 'black', white: 'white', safaid: 'white', safed: 'white',
  red: 'red', laal: 'red', lal: 'red', blue: 'blue', neela: 'blue', neeli: 'blue', green: 'green', hara: 'green',
  sabz: 'green', yellow: 'yellow', peela: 'yellow', peeli: 'yellow', pink: 'pink', gulabi: 'pink', brown: 'brown',
  grey: 'grey', gray: 'grey', orange: 'orange', purple: 'purple', maroon: 'maroon', navy: 'navy', beige: 'beige',
  golden: 'golden', silver: 'silver',
};

const SIZES: Record<string, string> = {
  xs: 'xs', small: 'small', medium: 'medium', large: 'large', xl: 'xl', xxl: 'xxl', xxxl: 'xxxl',
};

const SYNONYMS: Record<string, string> = {
  joote: 'shoe', joota: 'shoe', jootay: 'shoe', jootey: 'shoe', jootiyan: 'shoe', jooti: 'shoe', jute: 'shoe',
  patloon: 'pant', patlun: 'pant', trousers: 'trouser', kameez: 'kameez', tshirt: 't-shirt', tshirts: 't-shirt',
};

// Words that carry no product meaning in a shopping request.
const STOP = new Set([
  ...ROMAN_MARKERS, 'what', 'whats', 'which', 'who', 'is', 'are', 'am', 'the', 'this', 'that', 'these', 'those', 'it', 'its',
  'in', 'on', 'of', 'for', 'to', 'from', 'with', 'and', 'or', 'any', 'some', 'all', 'every', 'me', 'my', 'i', 'you',
  'your', 'we', 'us', 'our', 'do', 'does', 'have', 'has', 'got', 'can', 'could', 'would', 'please', 'pls', 'plz',
  'show', 'list', 'find', 'search', 'see', 'view', 'give', 'tell', 'want', 'need', 'looking', 'look', 'get', 'buy',
  'available', 'availability', 'stock', 'currently', 'current', 'right', 'now', 'today', 'store', 'shop', 'here',
  'product', 'products', 'item', 'items', 'thing', 'things', 'stuff', 'options', 'option', 'related', 'word', 'name',
  'named', 'called', 'containing', 'contains', 'under', 'below', 'less', 'than', 'over', 'above', 'more', 'between',
  'rs', 'pkr', 'rupees', 'rupay', 'price', 'prices', 'priced', 'out', 'left', 'only', 'just', 'also', 'too', 'there',
  'kuch', 'koi', 'kaun', 'saray', 'saari', 'tamam', 'kitny', 'wali', 'walay', 'wale', 'dikhado', 'dikhaiye',
  'dhoondo', 'dhoond', 'dhundo', 'search', 'karo', 'karen', 'karein', 'kijiye', 'chahiye', 'available', 'milte',
  'bechte', 'sell', 'selling', 'carry', 'offer', 'so', 'then', 'ok', 'okay', 'acha', 'achha', 'theek', 'yaar',
  'bhai', 'bro', 'sir', 'madam', 'jee', 'ji', 'han', 'haan', 'nahi', 'nahin', 'not', 'no', 'yes', 'kindly', 'stock',
  'mai', 'mei', 'me', 'aap', 'apke', 'aapke', 'apne', 'paas', 'pas', 'size', 'colour', 'color', 'rang', 'kitne',
  'unit', 'units', 'piece', 'pieces', 'pcs', 'qty', 'quantity', 'x', 'up', 'upto', 'within', 'max', 'min', 'least',
  'most', 'tak', 'neeche', 'upar', 'beech', 'darmiyan', 'categories', 'category', 'type', 'types', 'kind', 'kinds',
  'one', 'ones', 'like', 'similar', 'else', 'other', 'another', 'different', 'new', 'latest', 'khatam', 'end',
  'si', 'sa', 'add', 'daal', 'daalo', 'dalo', 'daldo', 'put', 'remove', 'delete', 'hata', 'hatao', 'nikal', 'nikalo',
  'cart', 'increase', 'decrease', 'set', 'make', 'change', 'update', 'cheaper', 'cheapest', 'cheap', 'expensive',
  'costliest', 'mehnga', 'mehngi', 'lowest', 'highest', 'how', 'many', 'much', 'agar', 'bhi', 'diya', 'dena',
]);

// Topics the deterministic layer must leave to the store policy tools / language model.
const NON_CATALOG = /\b(?:polic(?:y|ies)|returns?|refunds?|exchange|deliver(?:y|ies)|shipping|ship|cod|cash on delivery|payments?|pay|warranty|guarantee|timings?|open|close|location|address|contact|phone|owner|discount|coupon|sale|offer code|track|tracking|order status|my orders?)\b/;

function normalise(message: string): string {
  return message.toLowerCase()
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/\b(?:rs|pkr)\.?\s*(?=\d)/g, '')
    .replace(/(\d)\s*(?:rs|pkr|rupees|rupay)\b/g, '$1')
    .replace(/(\d+)\s*k\b/g, (_, n: string) => String(Number(n) * 1000))
    .replace(/['’`]/g, '')
    .replace(/[?!.,;:؟،()"“”]+/g, ' ')
    // "this store" names the shop, not a product the buyer is pointing at.
    .replace(/\b(?:in |of |from )?(?:this|is|iss|the|your|aap ke|aapke|apke|ap ke) (?:store|shop|dukan|dukaan)(?: mein| mai| me| main| se| ka| ki| ke)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectLang(words: string[]): ReplyLang {
  return words.some((word) => ROMAN_MARKERS.has(word)) ? 'roman' : 'en';
}

const SALAM = /^(?:(?:as+ala+m+u?|as+lam|salaa?m|slm)(?:\s*(?:o|u|-)?\s*(?:alaikum|alikum|aleikum|alaykum|alykum))?|aoa)\b\s*/;
const HELLO = /^(?:hi+|hello+|helo|hey+|hy|hlo|good (?:morning|evening|afternoon))\b\s*/;
const THANKS = /\b(?:thanks?|thank you|thankyou|thx|ty|shukriya|shukria|jazakallah\w*|meherbani)\b\s*/g;

function extractVariant(words: string[]): VariantWish {
  const wish: VariantWish = {};
  words.forEach((word, index) => {
    if (COLORS[word]) wish.color = COLORS[word];
    if (SIZES[word]) wish.size = SIZES[word];
    // Single-letter sizes only next to the word "size" ("size m", "m size").
    if (/^(?:s|m|l)$/.test(word) && (words[index - 1] === 'size' || words[index + 1] === 'size')) {
      wish.size = ({ s: 'small', m: 'medium', l: 'large' } as Record<string, string>)[word];
    }
  });
  return wish;
}

function isNumberWordAt(words: string[], index: number): number | null {
  const word = words[index] ?? '';
  if (word === 'do') {
    // Roman "do" means two only before a noun: "do shirts", not "kar do" / "do you have".
    const prev = words[index - 1] ?? '';
    const next = words[index + 1] ?? '';
    if (['kar', 'karo', 'de', 'dena', 'na', 'add'].includes(prev) || !next || ['you', 'kar', 'na', 'not', 'we', 'i', 'they'].includes(next)) return null;
    return 2;
  }
  if (word === 'a' || word === 'an') return null;
  return NUMBER_WORDS[word] ?? null;
}

function extractOrdinal(words: string[]): { index: number; label: boolean } | null {
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? '';
    const hash = /^#(\d{1,3})$/.exec(word);
    if (hash) return { index: Number(hash[1]), label: true };
    if (['number', 'no', 'num', 'item', 'product', 'nmbr'].includes(word) && /^\d{1,3}$/.test(words[i + 1] ?? '')) {
      return { index: Number(words[i + 1]), label: true };
    }
    if (ORDINALS[word] !== undefined) return { index: ORDINALS[word]!, label: false };
  }
  return null;
}

function extractQuantity(words: string[], ordinal: { index: number; label: boolean } | null): number | null {
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? '';
    if (/^(?:quantity|qty)$/.test(word)) {
      const next = words[i + 1] === 'to' ? words[i + 2] : words[i + 1];
      if (next && /^\d{1,3}$/.test(next)) return Number(next);
      const previous = words[i - 1];
      if (previous && /^\d{1,3}$/.test(previous)) return Number(previous);
    }
  }
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? '';
    const previous = words[i - 1] ?? '';
    const labelled = ['number', 'no', 'num', 'item', 'product', 'nmbr'].includes(previous);
    if (/^\d{1,3}$/.test(word) && !labelled && !(ordinal?.label && Number(word) === ordinal.index)) return Number(word);
    if (/^\d{1,3}x$/.test(word)) return Number(word.slice(0, -1));
    const spoken = isNumberWordAt(words, i);
    if (spoken !== null) return spoken;
  }
  return null;
}

function contentTerms(words: string[], variant: VariantWish): string[] {
  const terms = words
    .filter((word) => !/^#?\d+(?:st|nd|rd|th|x)?$/.test(word))
    .filter((word) => ORDINALS[word] === undefined && NUMBER_WORDS[word] === undefined && word !== 'do')
    .filter((word) => !SIZES[word] && !(variant.size && /^(?:s|m|l)$/.test(word)))
    .map((word) => SYNONYMS[word] ?? word)
    .filter((word) => !STOP.has(word) && word.length > 1 && /^[\p{L}\p{N}-]+$/u.test(word));
  // Colours stay as search words: many listings carry the colour in the title ("Black Cotton Shirt").
  return [...new Set(terms)];
}

function extractPrice(text: string): { minPrice?: number; maxPrice?: number } {
  const between = /(?:between|from)?\s*(\d{2,7})\s*(?:and|to|se|-|aur)\s*(\d{2,7})(?:\s*(?:ke\s*)?(?:beech|darmiyan|tak))?/.exec(text);
  if (between && /\b(?:between|beech|darmiyan|from|range)\b|\d\s*-\s*\d|\bse\b.*\btak\b|\bto\b/.test(text)) {
    const a = Number(between[1]);
    const b = Number(between[2]);
    return { minPrice: Math.min(a, b), maxPrice: Math.max(a, b) };
  }
  const max = /(?:under|below|less than|upto|up to|within|max(?:imum)?|cheaper than)\s*(\d{2,7})|(\d{2,7})\s*(?:se|say)\s*(?:kam|neeche|nichay|tak)|(\d{2,7})\s*(?:or less|and below|tak)/.exec(text);
  if (max) return { maxPrice: Number(max[1] ?? max[2] ?? max[3]) };
  const min = /(?:over|above|more than|min(?:imum)?|at least)\s*(\d{2,7})|(\d{2,7})\s*(?:se|say)\s*(?:zyada|ziada|upar|oopar)|(\d{2,7})\s*(?:or more|and above|plus)/.exec(text);
  if (min) return { minPrice: Number(min[1] ?? min[2] ?? min[3]) };
  return {};
}

function stockFilter(text: string): SearchSpec['stock'] {
  if (/\bout of stock\b|\bstock (?:khatam|nahi|nahin|ni)\b|\b(?:khatam|unavailable|sold out|not available|available nahi)\b/.test(text)) return 'out';
  if (/\bin stock\b|\bavailable\b|\bstock (?:mein|mai|me)\b|\babhi\b|\bmil(?:te|ta|ti|ega|egi)\b/.test(text)) return 'in';
  return 'any';
}

function refFrom(words: string[], text: string, terms: string[]): ProductRef | null {
  const ordinal = extractOrdinal(words);
  if (ordinal) return { kind: 'ordinal', ...ordinal };
  if (/\b(?:cheapest|cheaper|cheap|sasta|sasti|saste|sab se kam|lowest price|kam qeemat)\b/.test(text)) return { kind: 'cheapest' };
  if (/\b(?:most expensive|expensive|costliest|mehnga|mehngi|mehngay|mehange)\b/.test(text)) return { kind: 'priciest' };
  // "this shirt" / "is shirt" points at the product being discussed, not at a new search.
  const pointed = [...text.matchAll(/\b(?:this|that|is|iss|ye|yeh|woh|wo|us)\s+([\p{L}-]+)/gu)].map((match) => match[1] ?? '');
  if (pointed.some((word) => terms.includes(word) || ['product', 'item', 'wala', 'wali', 'one', 'cheez'].includes(word))) return { kind: 'this' };
  if (terms.length) return { kind: 'name', terms };
  if (/\b(?:this|it|its|that|is|isko|iski|iska|iske|ise|ye|yeh|woh|wo|usko|uski|uska|us|same)\b/.test(text)) return { kind: 'this' };
  return null;
}

export function parseShoppingMessage(message: string): ParsedShoppingMessage {
  let text = normalise(message);
  const allWords = text.split(' ').filter(Boolean);
  const lang = detectLang(allWords);
  let salam = false;
  let greeted = false;
  const salamMatch = SALAM.exec(text);
  if (salamMatch) { salam = true; greeted = true; text = text.slice(salamMatch[0].length); }
  const helloMatch = HELLO.exec(text);
  if (helloMatch) { greeted = true; text = text.slice(helloMatch[0].length); }
  const withoutThanks = text.replace(THANKS, ' ');
  const thanked = withoutThanks !== text;
  text = withoutThanks.replace(/^and\s+/, '').replace(/\s+/g, ' ').trim();
  const result = (intent: ShoppingIntent | null): ParsedShoppingMessage => ({ lang, salam, greeted, intent });

  if (!text) return result(greeted ? { type: 'greeting' } : thanked ? { type: 'thanks' } : null);
  if (text.length > 220) return result(null);
  const words = text.split(' ');

  if (/^(?:can you help(?: me)?|help(?: me)?|(?:how|what) can you (?:help|do)(?: for me)?(?: with)?|what do you do|aap kya kar sakte(?: ho| hain)?|ap kya kr skte ho|kya kar sakte ho|meri madad kar(?:o|en|ein|sakte ho)|madad)(?:\s+(?:me|mujhe|please))?$/.test(text)) {
    return result({ type: 'help' });
  }
  if (NON_CATALOG.test(text)) return result(null);

  const variant = extractVariant(words);
  const terms = contentTerms(words, variant);
  const addVerb = /\b(?:add|daal\w*|dal do|dalo|daldo|daal do|shamil kar\w*|put)\b/.test(text);
  const cartWord = /\bcart\b/.test(text);
  const removeVerb = /\b(?:remove|delete|hata\w*|nikal\w*|nikaal\w*|khatam kar\w*)\b/.test(text);

  if (cartWord && !addVerb && !removeVerb && !/\b(?:quantity|qty)\b/.test(text)
    && /\b(?:show|view|see|open|dikhao|dikha\w*|mera|meri|my|whats|what|kya|check)\b/.test(text)) {
    return result({ type: 'show_cart' });
  }
  if (removeVerb && (cartWord || refFrom(words, text, terms))) {
    const ref = refFrom(words, text, terms.filter((term) => term !== 'cart')) ?? { kind: 'this' };
    return result({ type: 'remove', ref });
  }
  const ordinal = extractOrdinal(words);
  const quantity = extractQuantity(words, ordinal);
  if (!addVerb && /\b(?:quantity|qty)\b/.test(text) && quantity !== null
    && /\b(?:kar|karo|kardo|set|make|increase|decrease|change|update|badal\w*|barha\w*|kam)\b|\bto \d/.test(text)) {
    const ref = refFrom(words, text, terms.filter((term) => term !== 'cart')) ?? { kind: 'this' };
    return result({ type: 'set_quantity', ref, quantity });
  }
  if (addVerb) {
    const ref = refFrom(words, text, terms.filter((term) => term !== 'cart')) ?? { kind: 'this' };
    return result({ type: 'add', ref, quantity: quantity ?? 1, variant });
  }

  if (/\b(?:similar|like this|is jaisa|is jaise|aise|aisa|isi tarah|related to this|more like)\b/.test(text)) {
    return result({ type: 'similar', ref: refFrom(words, text, []) ?? { kind: 'this' } });
  }
  const asksWhich = /\b(?:which|kaunsa|konsa|kaunsi|konsi|kon sa|kaun sa|kon si|kaun si)\b/.test(text);
  if (asksWhich && !terms.length && /\b(?:cheapest|cheaper|cheap|sasta|sasti|saste|kam)\b/.test(text)) {
    return result({ type: 'cheapest_of_list', highest: false });
  }
  if (asksWhich && !terms.length && /\b(?:expensive|costliest|mehnga|mehngi)\b/.test(text)) {
    return result({ type: 'cheapest_of_list', highest: true });
  }

  const priceAsk = /\b(?:price|prices|qeemat|keemat|kimat|cost|costs|rate|how much|kitne ka|kitne ki|kitne ke|kitnay ka|kitna ka)\b/.test(text);
  const stockAsk = /\b(?:how many|kitne|kitna|kitni|units left|left in stock|stock mein kitne|quantity available)\b/.test(text);
  const refersToShown = Boolean(ordinal) || /\b(?:this|it|its|that|is|isko|iski|iska|iske|ise|ye|yeh|woh|wo|us|uski|uska)\b/.test(text);
  const priceFilter = extractPrice(text);
  const hasPriceFilter = priceFilter.minPrice !== undefined || priceFilter.maxPrice !== undefined;
  const listingWord = /\b(?:products|items|cheezein|cheezain)\b/.test(text);
  if ((priceAsk || stockAsk) && !hasPriceFilter && (refersToShown || terms.length || !listingWord)) {
    const ref = refFrom(words, text, terms) ?? { kind: 'this' };
    return result({ type: 'detail', ref, ask: priceAsk ? 'price' : 'stock', variant });
  }
  const wantsVariant = Boolean(variant.size || variant.color);
  if ((refersToShown || wantsVariant) && !terms.filter((term) => !COLORS[term]).length
    && (/\b(?:available|in stock|milega|milegi|mil jayega)\b/.test(text) || wantsVariant)) {
    return result({ type: 'detail', ref: refFrom(words, text, []) ?? { kind: 'this' }, ask: 'availability', variant });
  }

  if (/\b(?:show more|more|next|agle|agla|aglay|aur dikhao|aur products|aur options|more options|next page|baqi|baaki)\b/.test(text)
    && terms.length <= 2 && !hasPriceFilter && !/\b(?:out of stock|khatam)\b/.test(text)) {
    if (/^(?:show )?more$|\bmore\b|\bnext\b|\bagl[ea]y?\b|\baur\b|\bbaa?qi\b/.test(text)) return result({ type: 'more', terms });
  }

  const listing = /\b(?:products?|items?|cheez\w*|chiz\w*|samaan|saman|stock|inventory|catalog(?:ue)?)\b/.test(text);
  const verb = /\b(?:show|list|find|search|dikhao|dikha\w*|dhoond\w*|dhund\w*|chahiye|chahie|want|need|looking|have|hain|hai|available|sell|bechte|milte|kya kya|kaun kaun|kon kon)\b/.test(text);
  if (terms.length > 4) return result(null);
  if (!terms.length && !listing && !hasPriceFilter) return result(greeted ? { type: 'greeting' } : thanked ? { type: 'thanks' } : null);
  const spec: SearchSpec = { terms, stock: stockFilter(text), ...priceFilter };
  // "show me shirts", "shirts hain?" and bare short phrases ("black tea") are explicit enough to
  // answer from the catalog; longer free-form questions without a verb go to the model.
  const explicit = verb || listing || hasPriceFilter || words.length <= 3;
  if (!explicit) return result(null);
  return result({ type: 'search', spec, explicit: verb || listing || hasPriceFilter, variant });
}
