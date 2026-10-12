import { prisma } from '../../core/prisma';

type Locale = 'en' | 'ur';
type CatalogProduct = { publicId: string; titleEn: string; price: { toString(): string }; stock: number };

interface CatalogRequest {
  phrases: string[];
  purchaseIntent: boolean;
  explicit: boolean;
}

const PREFIXES = [
  'i want to purchase', 'i want to buy', 'i would like to buy', 'can i buy',
  'do you have', 'have you got', 'do you sell', 'show me', 'i am looking for', "i'm looking for",
  'i want', 'i need', 'can i get', 'looking for', 'tell me about', 'what about', 'is there',
  'what is the price of', "what's the price of", 'how much is',
];

function parseCatalogRequest(message: string): CatalogRequest | null {
  let text = message.trim().replace(/[?.!؟]+$/u, '').trim().replace(/\s+/gu, ' ');
  if (!text || text.length > 160 || /\b(?:add|cart|checkout|payment|pay|place|complete|submit)\b/i.test(text)) return null;
  text = text.replace(/^and\s+/i, '');
  const availability = /^is (.+?) (?:available|in stock)$/i.exec(text);
  if (availability) text = availability[1] ?? text;
  const prefix = PREFIXES.find((candidate) => text.toLocaleLowerCase('en').startsWith(`${candidate} `));
  const purchaseIntent = Boolean(prefix && /\b(?:buy|purchase)\b/i.test(prefix));
  if (prefix) text = text.slice(prefix.length).trim();
  // Also accept short multi-product phrases such as "black tea and white sugar".
  // The per-phrase bounds below still reject long free-form prompts.

  const phrases = text.split(/\s+and\s+/i).map((phrase) =>
    phrase.replace(/^(?:a|an|any|some|the)\s+/i, '').replace(/\s+please$/i, '').trim().toLocaleLowerCase('en'));
  if (phrases.length > 3 || phrases.some((phrase) =>
    !phrase || phrase.length > 60 || phrase.split(' ').length > 4 || !/^[\p{L}\p{N}\s'-]+$/u.test(phrase))) return null;
  return { phrases, purchaseIntent, explicit: Boolean(prefix) };
}

function stem(word: string): string {
  const lower = word.toLocaleLowerCase('en');
  return lower.length > 3 && lower.endsWith('s') ? lower.slice(0, -1) : lower;
}

function tokens(text: string): string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1).map(stem);
}

// One insertion, deletion, or substitution is enough for common slips such as suger/sugar.
// Restrict fuzzy matches to longer words to avoid unrelated short grocery terms.
function oneEditAway(left: string, right: string): boolean {
  if (left === right || Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (left.length > right.length) i++;
    else if (right.length > left.length) j++;
    else { i++; j++; }
  }
  return edits + Number(i < left.length || j < right.length) <= 1;
}

function matchingProducts(phrase: string, candidates: CatalogProduct[]): { products: CatalogProduct[]; corrected: boolean } {
  const requested = tokens(phrase);
  if (!requested.length) return { products: [], corrected: false };
  const exact = candidates.filter((product) => {
    const title = tokens(product.titleEn);
    return requested.every((word) => title.includes(word));
  });
  if (exact.length) return { products: exact, corrected: false };
  const fuzzy = candidates.filter((product) => {
    const title = tokens(product.titleEn);
    return requested.every((word) => title.some((part) =>
      part === word || (word.length >= 4 && part.length >= 4 && oneEditAway(word, part))));
  });
  return { products: fuzzy, corrected: fuzzy.length > 0 };
}

export function formatCatalogListings(products: Array<{ titleEn: string; price: { toString(): string }; stock: number }>, locale: Locale): string {
  return products.map((product) => {
    const stock = product.stock > 0
      ? locale === 'ur' ? `${product.stock} دستیاب` : `${product.stock} in stock`
      : locale === 'ur' ? 'اس وقت دستیاب نہیں' : 'currently out of stock';
    return `${product.titleEn} — Rs. ${product.price.toString()} (${stock})`;
  }).join('; ');
}

export async function getCatalogReply(storeId: bigint, message: string, locale: Locale): Promise<string | null> {
  const request = parseCatalogRequest(message);
  if (!request) return null;
  const searchWords = [...new Set(request.phrases.flatMap(tokens))];
  if (!searchWords.length) return null;
  const candidates = await prisma.product.findMany({
    where: {
      sellerId: storeId, status: 'LIVE', deletedAt: null,
      OR: searchWords.map((word) => ({ titleEn: { contains: word.slice(0, 3), mode: 'insensitive' } })),
    },
    select: { publicId: true, titleEn: true, price: true, stock: true },
    orderBy: { titleEn: 'asc' },
    take: 200,
  });

  const replies = request.phrases.map((phrase) => {
    const match = matchingProducts(phrase, candidates);
    if (!match.products.length) return request.explicit
      ? `I couldn't find a live listing matching “${phrase}” in this store.`
      : null;
    const listed = formatCatalogListings(match.products.slice(0, 20), locale);
    const more = match.products.length > 20 ? ' There are more matching listings; please narrow your request.' : '';
    const strapOnly = /\bwristwatch\b/i.test(phrase) && !/\bstrap\b/i.test(phrase)
      && match.products.every((product) => /\bstrap\b/i.test(product.titleEn));
    if (strapOnly) return `I found a related listing: ${listed}. It is a watch strap, not a wristwatch.`;
    if (match.corrected) return `Did you mean: ${listed}?${more}`;
    return `${listed}.${more}`;
  });
  if (replies.every((reply) => reply === null)) return null;
  const summary = replies.filter((reply): reply is string => reply !== null).join(' ');
  const shoppingNote = request.purchaseIntent
    ? ' I have not added anything to your cart or placed an order. Tell me which item and quantity you want added to your cart.'
    : '';
  return `${summary}${shoppingNote}`;
}

export type CartLookup =
  | { kind: 'product'; productId: string; titleEn: string; quantity: number }
  | { kind: 'clarify'; reply: string };

export async function resolveCartRequest(storeId: bigint, message: string): Promise<CartLookup | null> {
  const match = /^(?:please\s+)?(?:add|put)\s+(?:(\d{1,2})\s+)?(.+?)\s+(?:to|in)\s+(?:my\s+|the\s+)?cart[?.!]*$/i.exec(message.trim());
  if (!match) return null;
  const quantity = Number(match[1] ?? 1);
  const phrase = (match[2] ?? '').replace(/^(?:a|an|the|some)\s+/i, '').trim().toLocaleLowerCase('en');
  if (!phrase || phrase.length > 60 || phrase.includes(' and ') || quantity < 1 || quantity > 99) {
    return { kind: 'clarify', reply: 'Please name one product and a quantity from 1 to 99. Nothing was added to your cart.' };
  }
  const words = tokens(phrase);
  if (!words.length) return { kind: 'clarify', reply: 'Please name a listed product. Nothing was added to your cart.' };
  const candidates = await prisma.product.findMany({
    where: {
      sellerId: storeId, status: 'LIVE', deletedAt: null,
      OR: words.map((word) => ({ titleEn: { contains: word.slice(0, 3), mode: 'insensitive' } })),
    },
    select: { publicId: true, titleEn: true, price: true, stock: true },
    take: 200,
  });
  const matched = matchingProducts(phrase, candidates);
  if (matched.corrected || matched.products.length !== 1) {
    const suggestion = matched.products.slice(0, 3).map((product) => product.titleEn).join('; ');
    return { kind: 'clarify', reply: suggestion
      ? `Please confirm one exact product: ${suggestion}. Nothing was added to your cart.`
      : `I couldn't find “${phrase}” in this store's live listings. Nothing was added to your cart.` };
  }
  const product = matched.products[0]!;
  return { kind: 'product', productId: product.publicId, titleEn: product.titleEn, quantity };
}
