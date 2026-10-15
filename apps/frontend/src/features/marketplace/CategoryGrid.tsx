import {
  BookOpen,
  Cpu,
  Dumbbell,
  Home as HomeIcon,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { CategoryDTO } from '@karobarai/shared';
import { ArrowIcon } from '../../components';
import { useLanguage } from '../../hooks';

interface CategoryGridProps {
  categories: CategoryDTO[];
}

type CategoryKey = 'beauty' | 'books' | 'electronics' | 'fashion' | 'grocery' | 'home' | 'mobile' | 'sports' | 'other';

interface CategoryRule {
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
  { test: /beauty|personal.?care/, key: 'beauty', icon: Sparkles },
  { test: /book|stationery/, key: 'books', icon: BookOpen },
  { test: /sport|outdoor|fitness/, key: 'sports', icon: Dumbbell },
];
const FALLBACK_RULE: CategoryRule = { test: /^$/, key: 'other', icon: Tag };

function ruleFor(slug: string): CategoryRule {
  return CATEGORY_RULES.find((rule) => rule.test.test(slug)) ?? FALLBACK_RULE;
}

// SCR-B01 categories band. Equal-height white tiles in a 4×2 desktop grid, each with a tinted
// icon disc, the localized name (2-line clamp) plus the other language as a lighter sub-label, and
// a trailing arrow that slides in on hover/focus. Names come from the API (admin data); the other
// language is shown as the sub-label, and a per-key i18n label is used only if the API name is
// blank (rule G).
export function CategoryGrid({ categories }: CategoryGridProps) {
  const { language } = useLanguage();
  const { t } = useTranslation('marketplace');

  return (
    <ul className="cat-grid">
      {categories.map((category) => {
        const { key, icon: Icon } = ruleFor(category.slug);
        const fallback = t(`categoryNames.${key}`, { defaultValue: '' });
        const nameEn = category.nameEn || fallback || category.slug;
        const nameUr = category.nameUr || fallback || category.slug;
        const name = language === 'UR' ? nameUr : nameEn;
        const other = language === 'UR' ? nameEn : nameUr;

        return (
          <li key={category.id}>
            <Link to={`/category/${category.slug}`} className={`cat-tile cat-tile--${key}`}>
              <span className="cat-tile__icon">
                <Icon size={26} aria-hidden="true" />
              </span>
              <span className="cat-tile__body">
                <span className="cat-tile__name">{name}</span>
                {other && other !== name && <span className="cat-tile__sub">{other}</span>}
              </span>
              <span className="cat-tile__arrow">
                <ArrowIcon size={18} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
