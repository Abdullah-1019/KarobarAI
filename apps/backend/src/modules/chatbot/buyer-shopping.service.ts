import { findStoreItems, PAGE_SIZE, searchCatalog, type CatalogItem, type SearchSpec } from './product-search.service';
import { hasVariantWish, listProductVariants, matchVariantIn, type ProductVariantOption, type VariantWish } from './product-variant.adapter';
import { parseShoppingMessage, type ProductRef, type ReplyLang, type ShoppingIntent } from './shopping-intent';
import type { ToolCall } from './slm-client';

// Deterministic buyer shopping flow shared by Fast and Slow Mode. Product facts come only from
// the store's live listings; cart changes go only through the shared buyer cart tools, and a
// reply says an item was added only when that tool reports success.

/** Compact record of what the buyer last saw, kept on the assistant message for follow-ups. */
export interface ShoppingState {
  refs: string[];
  offset: number;
  total?: number;
  spec?: SearchSpec;
  page?: number;
  focus?: string;
}

export interface ShoppingOutcome {
  reply: string;
  state: ShoppingState | null;
  steps: Array<{ toolCall: ToolCall; toolResult: unknown }>;
  cartChanged: boolean;
}

export interface ShoppingContext {
  storeId: bigint;
  storeName: string;
  state: ShoppingState | null;
  /** Runs one shared buyer cart tool (add_to_cart, check_cart, ...). */
  runTool: (toolCall: ToolCall) => Promise<unknown>;
}

type Text = Record<ReplyLang, string>;
const pick = (lang: ReplyLang, text: Text) => text[lang];

export function formatPrice(price: string | number): string {
  const value = Number(price);
  return `Rs. ${Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : price}`;
}

function stockText(stock: number, lang: ReplyLang): string {
  if (stock > 0) return lang === 'roman' ? `${stock} stock mein` : `${stock} in stock`;
  return lang === 'roman' ? 'stock khatam' : 'out of stock';
}

function line(item: CatalogItem, number: number, lang: ReplyLang): string {
  return `- #${number} ${item.titleEn} — ${formatPrice(item.price)} · ${stockText(item.stock, lang)}${item.category ? ` · ${item.category}` : ''}`;
}

function describeSpec(spec: SearchSpec, lang: ReplyLang): string {
  const parts: string[] = [];
  if (spec.terms.length) parts.push(`“${spec.terms.join(' ')}”`);
  if (spec.minPrice !== undefined && spec.maxPrice !== undefined) parts.push(`${formatPrice(spec.minPrice)}–${formatPrice(spec.maxPrice)}`);
  else if (spec.maxPrice !== undefined) parts.push(lang === 'roman' ? `${formatPrice(spec.maxPrice)} tak` : `up to ${formatPrice(spec.maxPrice)}`);
  else if (spec.minPrice !== undefined) parts.push(lang === 'roman' ? `${formatPrice(spec.minPrice)} se upar` : `from ${formatPrice(spec.minPrice)}`);
  if (spec.stock === 'in') parts.push(lang === 'roman' ? 'stock mein' : 'in stock');
  if (spec.stock === 'out') parts.push(lang === 'roman' ? 'stock khatam' : 'out of stock');
  return parts.join(', ');
}

async function listPage(ctx: ShoppingContext, spec: SearchSpec, page: number, lang: ReplyLang, note = ''): Promise<ShoppingOutcome> {
  const { items, total } = await searchCatalog(ctx.storeId, spec, page);
  const offset = page * PAGE_SIZE;
  const label = describeSpec(spec, lang);
  if (!items.length) {
    const reply = page > 0
      ? pick(lang, { en: 'That is everything — no more matching products.', roman: 'Bas itne hi the — aur koi matching product nahi.' })
      : spec.similarTo
        ? pick(lang, { en: 'I could not find similar live products in this store.', roman: 'Is store mein is jaisa koi aur product nahi mila.' })
        : pick(lang, {
          en: `I couldn't find any live products${label ? ` matching ${label}` : ''} in this store.`,
          roman: `Is store mein${label ? ` ${label} se milta` : ''} koi product nahi mila.`,
        });
    return { reply: reply + note, state: page > 0 ? ctx.state : null, steps: [], cartChanged: false };
  }
  const shownTo = offset + items.length;
  const head = pick(lang, {
    en: `I found ${total} ${total === 1 ? 'product' : 'products'}${label ? ` (${label})` : ''}${total > items.length ? `, showing ${offset + 1}–${shownTo}` : ''}:`,
    roman: `${total} ${total === 1 ? 'product mila' : 'products mile'}${label ? ` (${label})` : ''}${total > items.length ? `, ${offset + 1}–${shownTo} dikha raha hoon` : ''}:`,
  });
  const lines = items.map((item, index) => line(item, offset + index + 1, lang));
  const more = shownTo < total
    ? pick(lang, { en: `${total - shownTo} more — say “show more”.`, roman: `${total - shownTo} aur hain — “aur dikhao” likhein.` })
    : '';
  const hint = pick(lang, {
    en: `To buy, say e.g. “add #${offset + 1}” or “add 2 of #${offset + 1}”.`,
    roman: `Cart mein dalne ke liye likhein: “#${offset + 1} add karo” ya “#${offset + 1} ke 2 pieces add karo”.`,
  });
  return {
    reply: [head, ...lines, '', [more, hint].filter(Boolean).join(' ') + note].join('\n'),
    state: { refs: items.map((item) => item.productId), offset, total, spec, page, focus: items.length === 1 ? items[0]!.productId : undefined },
    steps: [],
    cartChanged: false,
  };
}

type Resolved =
  | { kind: 'product'; item: CatalogItem }
  | { kind: 'reply'; reply: string; state?: ShoppingState };

const ASK_FOR_PRODUCT: Text = {
  en: 'Which product do you mean? Search first (e.g. “show shirts”), then say its number, like “#2”.',
  roman: 'Kaunsa product? Pehle search karein (jaise “shirts dikhao”), phir uska number likhein, jaise “#2”.',
};

async function resolveRef(ctx: ShoppingContext, ref: ProductRef, lang: ReplyLang): Promise<Resolved> {
  const state = ctx.state;
  if (ref.kind === 'this') {
    const id = state?.focus ?? (state?.refs.length === 1 ? state.refs[0] : undefined);
    if (!id) return { kind: 'reply', reply: pick(lang, state?.refs.length ? {
      en: 'Which one do you mean? Please say its number from the list, like “#2”.',
      roman: 'Kaunsa wala? List mein se uska number likhein, jaise “#2”.',
    } : ASK_FOR_PRODUCT) };
    const [item] = await findStoreItems(ctx.storeId, [id]);
    return item ? { kind: 'product', item } : { kind: 'reply', reply: pick(lang, { en: 'That product is no longer available in this store.', roman: 'Yeh product ab is store mein available nahi.' }) };
  }
  if (ref.kind === 'ordinal') {
    if (!state?.refs.length) return { kind: 'reply', reply: pick(lang, ASK_FOR_PRODUCT) };
    let id: string | undefined;
    if (ref.index === -1) id = state.refs[state.refs.length - 1];
    else if (ref.index > state.offset && ref.index <= state.offset + state.refs.length) id = state.refs[ref.index - state.offset - 1];
    else if (!ref.label && ref.index <= state.refs.length) id = state.refs[ref.index - 1];
    if (!id) return { kind: 'reply', reply: pick(lang, {
      en: `There is no #${ref.index} in the list I showed. Please pick a number from it.`,
      roman: `Dikhayi gayi list mein #${ref.index} nahi hai. Usi list se number chunein.`,
    }) };
    const [item] = await findStoreItems(ctx.storeId, [id]);
    return item ? { kind: 'product', item } : { kind: 'reply', reply: pick(lang, { en: 'That product is no longer available in this store.', roman: 'Yeh product ab is store mein available nahi.' }) };
  }
  if (ref.kind === 'cheapest' || ref.kind === 'priciest') {
    const items = await findStoreItems(ctx.storeId, state?.refs ?? []);
    if (!items.length) return { kind: 'reply', reply: pick(lang, ASK_FOR_PRODUCT) };
    const sorted = [...items].sort((a, b) => Number(a.price) - Number(b.price));
    return { kind: 'product', item: ref.kind === 'cheapest' ? sorted[0]! : sorted[sorted.length - 1]! };
  }
  // By name: prefer the list the buyer is looking at, then the whole store.
  const shown = await findStoreItems(ctx.storeId, state?.refs ?? []);
  const words = ref.terms.map((term) => term.toLowerCase());
  const inList = shown.filter((item) => words.every((word) => item.titleEn.toLowerCase().includes(word.replace(/s$/, ''))));
  if (inList.length === 1) return { kind: 'product', item: inList[0]! };
  const candidates = inList.length > 1 ? inList : (await searchCatalog(ctx.storeId, { terms: ref.terms, stock: 'any' }, 0, 6)).items;
  if (candidates.length === 1) return { kind: 'product', item: candidates[0]! };
  if (!candidates.length) return { kind: 'reply', reply: pick(lang, {
    en: `I couldn't find “${ref.terms.join(' ')}” in this store's live listings.`,
    roman: `Is store mein “${ref.terms.join(' ')}” nahi mila.`,
  }) };
  const lines = candidates.slice(0, 6).map((item, index) => line(item, index + 1, lang));
  return {
    kind: 'reply',
    reply: [pick(lang, { en: 'Which one do you mean?', roman: 'Inn mein se kaunsa?' }), ...lines, '', pick(lang, {
      en: 'Say its number, e.g. “#1”. Nothing was changed.', roman: 'Number likhein, jaise “#1”. Abhi kuch change nahi hua.',
    })].join('\n'),
    state: { refs: candidates.slice(0, 6).map((item) => item.productId), offset: 0 },
  };
}

function withFocus(state: ShoppingState | null, productId: string): ShoppingState {
  return { ...(state ?? { refs: [productId], offset: 0 }), focus: productId };
}

function unmetWish(item: CatalogItem, wish: VariantWish): VariantWish {
  const title = item.titleEn.toLowerCase();
  return {
    ...(wish.size && !new RegExp(`\\b${wish.size}\\b`).test(title) ? { size: wish.size } : {}),
    ...(wish.color && !title.includes(wish.color) ? { color: wish.color } : {}),
  };
}

async function variantProblem(item: CatalogItem, wish: VariantWish, lang: ReplyLang): Promise<string | null> {
  const missing = unmetWish(item, wish);
  if (!hasVariantWish(missing)) return null;
  // Only reached for products without recorded variants.
  const match = matchVariantIn([], missing);
  const wanted = [missing.size, missing.color].filter(Boolean).join(' ');
  if (match.kind === 'match') return null;
  if (match.kind === 'none_recorded') return pick(lang, {
    en: `${item.titleEn} has no size or colour options recorded, so I can't confirm “${wanted}”. It is listed as a single item (${stockText(item.stock, lang)}).`,
    roman: `${item.titleEn} ke size/colour options record nahi hain, is liye “${wanted}” confirm nahi kar sakta. Yeh ek hi listing hai (${stockText(item.stock, lang)}).`,
  });
  return pick(lang, { en: `“${wanted}” is not available for ${item.titleEn}.`, roman: `${item.titleEn} mein “${wanted}” available nahi.` });
}

function optionLines(options: ProductVariantOption[], lang: ReplyLang): string[] {
  return options.map((option) => `- ${option.label} — ${stockText(option.stock, lang)}`);
}

/** Picks the size/colour the buyer asked for among recorded variants, or explains the choices. */
function pickVariant(item: CatalogItem, options: ProductVariantOption[], wish: VariantWish, lang: ReplyLang): { variant: ProductVariantOption } | { reply: string } {
  const match = matchVariantIn(options, wish);
  if (match.kind === 'match') return { variant: match.variant };
  const shown = match.kind === 'ambiguous' ? match.options : options;
  const wanted = [wish.size, wish.color].filter(Boolean).join(' ');
  const head = match.kind === 'unavailable' && wanted
    ? pick(lang, { en: `${item.titleEn} doesn't come in “${wanted}”. It comes in:`, roman: `${item.titleEn} “${wanted}” mein nahi aata. Yeh options hain:` })
    : pick(lang, { en: `${item.titleEn} comes in these options — which one?`, roman: `${item.titleEn} in options mein aata hai — kaunsa chahiye?` });
  return { reply: [head, ...optionLines(shown, lang), '', pick(lang, {
    en: `Say e.g. “add ${shown[0]!.label}”.`, roman: `Jaise likhein: “${shown[0]!.label} add karo”.`,
  })].join('\n') };
}

async function cartItemsForStore(ctx: ShoppingContext) {
  const result = await ctx.runTool({ type: 'check_cart', payload: {} }) as {
    ok?: boolean; error?: string;
    sellerGroups?: Array<{ items: Array<{ productId: string; titleEn: string; quantity: number; price: string; lineSubtotal: string }>; subtotal: string }>;
  };
  return { result, items: result.sellerGroups?.flatMap((group) => group.items) ?? [], subtotal: result.sellerGroups?.[0]?.subtotal };
}

async function handleIntent(ctx: ShoppingContext, intent: ShoppingIntent, lang: ReplyLang): Promise<ShoppingOutcome | null> {
  const done = (reply: string, state: ShoppingState | null = ctx.state, steps: ShoppingOutcome['steps'] = [], cartChanged = false): ShoppingOutcome =>
    ({ reply, state, steps, cartChanged });

  switch (intent.type) {
    case 'greeting':
      return done(pick(lang, {
        en: `Welcome to ${ctx.storeName}! Ask me to show products, check a price or stock, or add something to your cart.`,
        roman: `${ctx.storeName} mein khush aamdeed! Aap products dekh sakte hain, price ya stock pooch sakte hain, ya cart mein add karwa sakte hain.`,
      }));
    case 'thanks':
      return done(pick(lang, { en: 'You’re welcome! Anything else I can find for you?', roman: 'Koi baat nahi! Aur kuch dhoond doon?' }));
    case 'help':
      return done(pick(lang, {
        en: `I can help you shop at ${ctx.storeName}:\n- show products, a category or a price range (“shirts under 2000”)\n- tell you a product’s price and stock\n- add, remove or change items in your cart and show your cart\nOrders are confirmed only at checkout.`,
        roman: `Main ${ctx.storeName} mein shopping mein madad kar sakta hoon:\n- products, category ya price range dikhana (“2000 se kam shirts”)\n- kisi product ki price aur stock batana\n- cart mein add, remove ya quantity change karna aur cart dikhana\nOrder sirf checkout par confirm hota hai.`,
      }));
    case 'search': {
      const note = intent.variant.size
        ? pick(lang, { en: ' Note: size options are not recorded for this store’s listings.', roman: ' Note: is store ki listings mein size options record nahi hain.' })
        : '';
      const outcome = await listPage(ctx, intent.spec, 0, lang, note);
      return !intent.explicit && !outcome.state ? null : outcome;
    }
    case 'more': {
      const spec = ctx.state?.spec;
      const sameTerms = spec && (!intent.terms.length || intent.terms.every((term) => spec.terms.some((existing) => existing.replace(/s$/, '') === term.replace(/s$/, ''))));
      if (spec && sameTerms) return listPage(ctx, spec, (ctx.state?.page ?? 0) + 1, lang);
      if (intent.terms.length) return listPage(ctx, { terms: intent.terms, stock: 'any' }, 0, lang);
      return listPage(ctx, { terms: [], stock: 'any' }, 0, lang);
    }
    case 'similar': {
      const resolved = await resolveRef(ctx, intent.ref, lang);
      if (resolved.kind === 'reply') return done(resolved.reply, resolved.state ?? ctx.state);
      return listPage(ctx, { terms: [], stock: 'in', similarTo: resolved.item.productId }, 0, lang);
    }
    case 'cheapest_of_list': {
      const items = await findStoreItems(ctx.storeId, ctx.state?.refs ?? []);
      if (!items.length) return done(pick(lang, ASK_FOR_PRODUCT));
      const sorted = [...items].sort((a, b) => Number(a.price) - Number(b.price));
      const item = intent.highest ? sorted[sorted.length - 1]! : sorted[0]!;
      const number = (ctx.state?.offset ?? 0) + (ctx.state?.refs.indexOf(item.productId) ?? 0) + 1;
      return done(pick(lang, {
        en: `${intent.highest ? 'The most expensive' : 'The cheapest'} of these is #${number} ${item.titleEn} at ${formatPrice(item.price)} (${stockText(item.stock, lang)}).`,
        roman: `Inn mein ${intent.highest ? 'sab se mehnga' : 'sab se sasta'} #${number} ${item.titleEn} hai — ${formatPrice(item.price)} (${stockText(item.stock, lang)}).`,
      }), withFocus(ctx.state, item.productId));
    }
    case 'detail': {
      const resolved = await resolveRef(ctx, intent.ref, lang);
      if (resolved.kind === 'reply') return done(resolved.reply, resolved.state ?? ctx.state);
      const { item } = resolved;
      const state = withFocus(ctx.state, item.productId);
      const options = await listProductVariants(item.productId);
      if (options.length) {
        // Recorded variants: answer for the asked size/colour, or list every option's stock.
        if (hasVariantWish(intent.variant)) {
          const choice = pickVariant(item, options, intent.variant, lang);
          if ('reply' in choice) return done(choice.reply, state);
          return done(pick(lang, {
            en: `${item.titleEn} (${choice.variant.label}): ${stockText(choice.variant.stock, lang)}, ${formatPrice(item.price)}.`,
            roman: `${item.titleEn} (${choice.variant.label}): ${stockText(choice.variant.stock, lang)}, price ${formatPrice(item.price)}.`,
          }), state);
        }
        return done([pick(lang, {
          en: `${item.titleEn} costs ${formatPrice(item.price)} and comes in:`,
          roman: `${item.titleEn} ki price ${formatPrice(item.price)} hai, aur yeh options hain:`,
        }), ...optionLines(options, lang)].join('\n'), state);
      }
      const problem = hasVariantWish(intent.variant) ? await variantProblem(item, intent.variant, lang) : null;
      if (problem) return done(problem, state);
      if (intent.ask === 'price') return done(pick(lang, {
        en: `${item.titleEn} costs ${formatPrice(item.price)} (${stockText(item.stock, lang)}).`,
        roman: `${item.titleEn} ki price ${formatPrice(item.price)} hai (${stockText(item.stock, lang)}).`,
      }), state);
      return done(item.stock > 0 ? pick(lang, {
        en: `Yes — ${item.titleEn} has ${item.stock} ${item.stock === 1 ? 'unit' : 'units'} in stock, at ${formatPrice(item.price)}.`,
        roman: `Ji haan — ${item.titleEn} ke ${item.stock} pieces stock mein hain, price ${formatPrice(item.price)}.`,
      }) : pick(lang, {
        en: `${item.titleEn} is currently out of stock.`,
        roman: `${item.titleEn} abhi stock mein nahi hai.`,
      }), state);
    }
    case 'add': {
      if (!Number.isInteger(intent.quantity) || intent.quantity < 1 || intent.quantity > 99) {
        return done(pick(lang, { en: 'Please choose a quantity from 1 to 99. Nothing was added.', roman: 'Quantity 1 se 99 tak likhein. Kuch add nahi hua.' }));
      }
      const resolved = await resolveRef(ctx, intent.ref, lang);
      if (resolved.kind === 'reply') return done(resolved.reply, resolved.state ?? ctx.state);
      const { item } = resolved;
      const state = withFocus(ctx.state, item.productId);
      const nothingAdded = pick(lang, { en: 'Nothing was added.', roman: 'Kuch add nahi hua.' });
      const options = await listProductVariants(item.productId);
      let variant: ProductVariantOption | undefined;
      if (options.length) {
        const choice = pickVariant(item, options, intent.variant, lang);
        if ('reply' in choice) return done(`${choice.reply}\n${nothingAdded}`, state);
        variant = choice.variant;
      } else {
        const problem = hasVariantWish(intent.variant) ? await variantProblem(item, intent.variant, lang) : null;
        if (problem) return done(`${problem} ${nothingAdded}`, state);
      }
      const name = variant ? `${item.titleEn} (${variant.label})` : item.titleEn;
      if ((variant ? variant.stock : item.stock) <= 0) return done(pick(lang, {
        en: `${name} is out of stock, so nothing was added.`, roman: `${name} ka stock khatam hai, is liye kuch add nahi hua.`,
      }), state);
      const toolCall: ToolCall = { type: 'add_to_cart', payload: {
        productId: item.productId, quantity: intent.quantity, variantAttributes: {}, ...(variant ? { variantId: variant.variantId } : {}),
      } };
      const toolResult = await ctx.runTool(toolCall) as { ok?: boolean; error?: string; availableStock?: number; quantityAdded?: number };
      if (toolResult?.ok === true && toolResult.quantityAdded === intent.quantity) {
        return done(pick(lang, {
          en: `Added ${intent.quantity} × ${name} to your cart (${formatPrice(Number(item.price) * intent.quantity)}). No order has been placed — review it at checkout.`,
          roman: `${intent.quantity} × ${name} cart mein add ho gaya (${formatPrice(Number(item.price) * intent.quantity)}). Order abhi place nahi hua — checkout par confirm karein.`,
        }), state, [{ toolCall, toolResult }], true);
      }
      if (typeof toolResult?.availableStock === 'number') return done(pick(lang, {
        en: `Only ${toolResult.availableStock} of ${name} ${toolResult.availableStock === 1 ? 'is' : 'are'} in stock (including any already in your cart). Want a smaller quantity? Nothing was added.`,
        roman: `${name} ke sirf ${toolResult.availableStock} pieces stock mein hain (cart wale mila kar). Kam quantity add karoon? Abhi kuch add nahi hua.`,
      }), state, [{ toolCall, toolResult }]);
      return done(`${toolResult?.error ?? pick(lang, { en: 'I could not confirm the cart update.', roman: 'Cart update confirm nahi ho saka.' })} ${pick(lang, { en: 'Nothing was added.', roman: 'Kuch add nahi hua.' })}`, state, [{ toolCall, toolResult }]);
    }
    case 'show_cart': {
      const { result, items, subtotal } = await cartItemsForStore(ctx);
      const toolCall: ToolCall = { type: 'check_cart', payload: {} };
      if (result?.ok === false) return done(result.error ?? pick(lang, { en: 'I could not read your cart.', roman: 'Cart parha nahi ja saka.' }), ctx.state, [{ toolCall, toolResult: result }]);
      if (!items.length) return done(pick(lang, { en: `Your cart has nothing from ${ctx.storeName} yet.`, roman: `Aap ke cart mein abhi ${ctx.storeName} ka koi item nahi.` }), ctx.state, [{ toolCall, toolResult: result }]);
      const lines = items.map((item, index) => `- #${index + 1} ${item.titleEn} × ${item.quantity} — ${formatPrice(item.lineSubtotal)}`);
      return done([
        pick(lang, { en: `Your cart at ${ctx.storeName}:`, roman: `${ctx.storeName} se aap ka cart:` }),
        ...lines,
        '',
        pick(lang, { en: `Subtotal: ${formatPrice(subtotal ?? '0')}. Checkout to place the order.`, roman: `Subtotal: ${formatPrice(subtotal ?? '0')}. Order ke liye checkout karein.` }),
      ].join('\n'), { refs: items.map((item) => item.productId), offset: 0 }, [{ toolCall, toolResult: result }]);
    }
    case 'remove':
    case 'set_quantity': {
      const resolved = await resolveRef(ctx, intent.ref, lang);
      if (resolved.kind === 'reply') return done(resolved.reply, resolved.state ?? ctx.state);
      const { item } = resolved;
      const state = withFocus(ctx.state, item.productId);
      const toolCall: ToolCall = intent.type === 'remove'
        ? { type: 'remove_from_cart', payload: { productId: item.productId } }
        : { type: 'update_cart_quantity', payload: { productId: item.productId, quantity: intent.quantity } };
      const toolResult = await ctx.runTool(toolCall) as { ok?: boolean; error?: string; availableStock?: number };
      if (toolResult?.ok === true) {
        return done(intent.type === 'remove'
          ? pick(lang, { en: `Removed ${item.titleEn} from your cart.`, roman: `${item.titleEn} cart se hata diya.` })
          : pick(lang, { en: `${item.titleEn} quantity is now ${intent.quantity} in your cart.`, roman: `Cart mein ${item.titleEn} ki quantity ab ${intent.quantity} hai.` }), state, [{ toolCall, toolResult }], true);
      }
      if (typeof toolResult?.availableStock === 'number') return done(pick(lang, {
        en: `Only ${toolResult.availableStock} of ${item.titleEn} are in stock. Your cart was not changed.`,
        roman: `${item.titleEn} ke sirf ${toolResult.availableStock} pieces stock mein hain. Cart change nahi hua.`,
      }), state, [{ toolCall, toolResult }]);
      return done(`${toolResult?.error ?? pick(lang, { en: 'I could not confirm the cart update.', roman: 'Cart update confirm nahi ho saka.' })} ${pick(lang, { en: 'Your cart was not changed.', roman: 'Cart change nahi hua.' })}`, state, [{ toolCall, toolResult }]);
    }
    default:
      return null;
  }
}

/** Answers the message from the catalog/cart, or returns null to let the language model answer. */
export async function handleShoppingMessage(ctx: ShoppingContext, message: string): Promise<ShoppingOutcome | null> {
  const parsed = parseShoppingMessage(message);
  if (!parsed.intent) return null;
  const outcome = await handleIntent(ctx, parsed.intent, parsed.lang);
  if (!outcome) return null;
  if (parsed.salam && parsed.intent.type !== 'greeting') outcome.reply = `Wa alaikum assalam! ${outcome.reply}`;
  return outcome;
}
