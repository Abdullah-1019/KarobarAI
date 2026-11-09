import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import type { ProductDetailDTO } from '@karobarai/shared';
import { CATEGORY_ART, ruleFor, type CategoryKey } from './categoryVisuals';
import { getPublicStorefront, type PublicStorefront, type StoreDirectoryItem } from './storeApi';

export interface WallPhoto {
  key: string;
  image: string;
  /** zoom slightly from the top, to lose a seller's watermark in the bottom corner */
  trim?: boolean;
}

/** The one product the home page's story follows from the hero through the feature cards. */
export interface StoryProduct {
  image: string;
  titleEn: string;
  titleUr: string | null;
  price: string;
  storeName: string;
}

const STORE_LIMIT = 8;
const MIN_PHOTOS = 8;

// The launch picks: the marketplace's best lifestyle photos, chosen by eye from the live catalogue
// (full-frame, warm, no poster text) and ordered so neighbours differ in colour. A pick that is
// gone from the catalogue simply drops out.
const HERO_PICKS = [
  '43e56f69-843e-4a2c-8d66-58db1078d5d5', // red khussa
  '65607709-89b1-48a7-8be6-3e4ca68c4a14', // perfume
  'c06256ac-107d-4d74-9878-ae35bad7b806', // wall clock
  'b2c2360d-124a-482b-b3b6-2ab2a6d84291', // nail polish
  '4ceb9946-d8be-45fb-9fd3-2bb0e19e4c72', // string-light lantern
  '78d6f798-c81e-4116-ba37-aeaad7cd5df4', // peshawari chappal
  '4c767ce6-3ef1-4773-bf92-0fd6e84f7f52', // flower arrangement
  '79ab7e0a-c134-4a38-a0cf-f8d09eaab8db', // hair serum
  'ed4ecead-26b4-402a-bc4d-d5802cb303eb', // penny loafers
  '76e4245f-7e38-46f5-95ee-6e07e4664255', // curtains
  '42c30aff-3213-4816-8e7a-df75cdd0923c', // decorative tray
  '2b5f068b-d113-40ea-8e4b-e02d562989f1', // blue heels
  '9a0c8bf7-2fd2-419e-809f-967913d1124c', // calligraphy panel
  '12295423-2777-4899-9a13-b7b6946eface', // hair mask
  '7a979820-d4fd-42d7-bec3-0cdd637d4363', // leather wallet
  'fd06a2de-59b6-4b95-9874-a82e2a4a692f', // prayer mat
  '70b57740-e5a7-422c-8567-e5c36dedc338', // bridal khussa
  'a0492788-795e-4005-bc69-0a56d07c1ca3', // moisturizing cream
  'b2732b67-dc8b-418b-82ff-acea2da40e94', // wall mirror
  'db5dbfbb-e256-4e64-ab79-cd5317d167d7', // slide slippers
  '754f3efb-83d3-43d8-8ff6-88a9fab6c056', // argan hair oil
  '3de5cbb8-d178-499d-aecd-1a6bba11345a', // casual sneakers
  '93801b02-570a-4069-837c-b2b2899a29d2', // scalloped phone cover
  '14bd3746-175a-4400-a9e6-bcfc58db64e8', // magnetic phone cases
  'bf64c454-1023-40cf-b5ac-bdb113653407', // printed bedspread
  '6c28c769-18e5-4a7d-9cde-4452daaf71e2', // character sandals
  '5e8ff077-01e9-45cf-8622-de21782aa233', // neem face wash
];
const TRIMMED_PICKS = new Set(['4ceb9946-d8be-45fb-9fd3-2bb0e19e4c72']);
const STORY_PRODUCT_ID = '65607709-89b1-48a7-8be6-3e4ca68c4a14'; // perfume: a sharp, 1080px photo

/* When the picks are unavailable (a different catalogue), premium categories stand in. */
const PREMIUM_TONES = new Set<CategoryKey>(['fashion', 'beauty', 'home', 'electronics', 'mobile']);
const FALLBACK_KEYS: CategoryKey[] = ['fashion', 'electronics', 'home', 'beauty', 'mobile'];
const isPremium = (slug: string | undefined | null) => !!slug && PREMIUM_TONES.has(ruleFor(slug).key);

interface PoolItem {
  image: string;
  category: string | undefined;
  titleEn: string;
  titleUr: string | null;
  price: string;
  storeName: string | null;
}

function buildPool(storefronts: (PublicStorefront | undefined)[], feed: ProductDetailDTO[]) {
  const pool = new Map<string, PoolItem>();
  storefronts.forEach((front) => {
    front?.products.forEach((product) => {
      if (!product.imageUrl) return;
      pool.set(product.id, {
        image: product.imageUrl,
        category: product.category?.slug ?? front.store.category?.slug,
        titleEn: product.titleEn,
        titleUr: product.titleUr,
        price: product.price,
        storeName: front.store.name,
      });
    });
  });
  feed.forEach((product) => {
    const first = [...product.images].sort((a, b) => a.position - b.position)[0];
    if (!first || pool.has(product.id)) return;
    pool.set(product.id, {
      image: first.url,
      category: product.category?.slug,
      titleEn: product.titleEn,
      titleUr: product.titleUr,
      price: product.price,
      storeName: null,
    });
  });
  return pool;
}

function buildPhotos(pool: Map<string, PoolItem>): WallPhoto[] {
  const picked = HERO_PICKS.flatMap((id) => {
    const hit = pool.get(id);
    return hit ? [{ key: id, image: hit.image, trim: TRIMMED_PICKS.has(id) }] : [];
  });
  if (picked.length >= MIN_PHOTOS) return picked;

  const seen = new Set<string>();
  const premium: WallPhoto[] = [];
  pool.forEach((item, id) => {
    if (isPremium(item.category) && !seen.has(item.image)) {
      seen.add(item.image);
      premium.push({ key: id, image: item.image });
    }
  });
  if (premium.length >= MIN_PHOTOS) return premium;

  // Nothing to show yet: the category illustrations keep the wall alive.
  return FALLBACK_KEYS.flatMap((key) => {
    const image = CATEGORY_ART[key];
    return image ? [{ key: `art-${key}`, image }] : [];
  });
}

/** The chosen story product, else any premium product that has a store, so the story still runs on
 *  a different catalogue. Null while nothing suitable exists: the cards then show no product. */
function pickStory(pool: Map<string, PoolItem>): StoryProduct | null {
  const chosen = pool.get(STORY_PRODUCT_ID);
  const item = chosen?.storeName
    ? chosen
    : [...pool.values()].find((candidate) => candidate.storeName && isPremium(candidate.category));
  if (!item?.storeName) return null;
  return { image: item.image, titleEn: item.titleEn, titleUr: item.titleUr, price: item.price, storeName: item.storeName };
}

// Photos for the hero wall and the product for the story, from the featured stores' storefronts
// (the same cached queries the store cards below use) plus the home feed. Decided once, when every
// source has answered, so the photos appear and then stay put.
export function useHomePhotos(stores: StoreDirectoryItem[], products: ProductDetailDTO[], loading: boolean) {
  const storefronts = useQueries({
    queries: stores.slice(0, STORE_LIMIT).map((store) => ({
      queryKey: ['storefront', store.slug],
      queryFn: () => getPublicStorefront(store.slug),
      staleTime: 5 * 60_000,
    })),
  });
  const storefrontStamp = storefronts.map((query) => query.dataUpdatedAt).join('|');
  const productStamp = products.map((product) => product.id).join('|');
  const settled = !loading && storefronts.every((query) => !query.isPending);

  return useMemo(() => {
    if (!settled) return { photos: [] as WallPhoto[], story: null };
    const pool = buildPool(storefronts.map((query) => query.data), products);
    return { photos: buildPhotos(pool), story: pickStory(pool) };
    // the stamps track the query results; the arrays themselves are new every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, storefrontStamp, productStamp]);
}
