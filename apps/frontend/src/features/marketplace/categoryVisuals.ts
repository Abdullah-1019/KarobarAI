// Shared category visuals (icon, tint key, illustration) — used by the Home category grid and the
// Category page banner so both read a category the same way.
import {
  BookOpen,
  Cpu,
  Dumbbell,
  Home as HomeIcon,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Flower2,
  Tag,
  type LucideIcon,
} from 'lucide-react';

export type CategoryKey =
  | 'beauty'
  | 'books'
  | 'electronics'
  | 'fashion'
  | 'grocery'
  | 'home'
  | 'mobile'
  | 'sports'
  | 'other';

export interface CategoryRule {
  test: RegExp;
  key: CategoryKey;
  icon: LucideIcon;
}

// Categories are admin-managed data (F4-catalog-backend.md), not a fixed enum, so this is a
// best-effort keyword→(icon + tint) heuristic (first match wins) with a neutral Tag fallback for
// anything unmatched — not a hardcoded slug lookup that would silently break the moment an admin
// adds or renames a category. The `key` also drives the per-tile tint class and the localized
// fallback label (used only when the API returns a blank name).
const CATEGORY_RULES: CategoryRule[] = [
  { test: /electronic/, key: 'electronics', icon: Cpu },
  { test: /mobile|phone/, key: 'mobile', icon: Smartphone },
  { test: /fashion|cloth|apparel/, key: 'fashion', icon: Shirt },
  { test: /home|kitchen|furniture/, key: 'home', icon: HomeIcon },
  { test: /grocery|food/, key: 'grocery', icon: ShoppingBasket },
  { test: /beauty|personal.?care/, key: 'beauty', icon: Flower2 },
  { test: /book|stationery/, key: 'books', icon: BookOpen },
  { test: /sport|outdoor|fitness/, key: 'sports', icon: Dumbbell },
];
const FALLBACK_RULE: CategoryRule = { test: /^$/, key: 'other', icon: Tag };

// The hand-authored Haveli illustration for each known category family (public/demo/products).
// Unmatched admin-created categories fall back to their icon on a tonal disc.
export const CATEGORY_ART: Partial<Record<CategoryKey, string>> = {
  beauty: '/demo/products/beauty-personal-care.svg',
  books: '/demo/products/books-stationery.svg',
  electronics: '/demo/products/electronics.svg',
  fashion: '/demo/products/fashion-clothing.svg',
  grocery: '/demo/products/grocery.svg',
  home: '/demo/products/home-kitchen.svg',
  mobile: '/demo/products/mobile-accessories.svg',
  sports: '/demo/products/sports-outdoors.svg',
};

export function ruleFor(slug: string): CategoryRule {
  return CATEGORY_RULES.find((rule) => rule.test.test(slug)) ?? FALLBACK_RULE;
}
