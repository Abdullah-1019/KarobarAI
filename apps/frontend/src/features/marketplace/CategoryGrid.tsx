import { Card, Typography } from 'antd';
import { BookOpen, Cpu, Dumbbell, Flower2, Home as HomeIcon, Shirt, ShoppingBasket, Smartphone, Tag, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { CategoryDTO } from '@karobarai/shared';
import { useLanguage } from '../../hooks';

interface CategoryGridProps {
  categories: CategoryDTO[];
}

// Categories are admin-managed data (F4-catalog-backend.md), not a fixed enum, so this is a
// best-effort keyword→icon heuristic (first match wins) with a neutral Tag fallback for anything
// unmatched — not a hardcoded slug lookup that would silently break the moment an admin adds or
// renames a category.
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/electronic/, Cpu],
  [/mobile|phone/, Smartphone],
  [/fashion|cloth|apparel/, Shirt],
  [/home|kitchen|furniture/, HomeIcon],
  [/grocery|food/, ShoppingBasket],
  [/beauty|personal.?care/, Flower2],
  [/book|stationery/, BookOpen],
  [/sport|outdoor|fitness/, Dumbbell],
];

function iconFor(slug: string): LucideIcon {
  return ICON_RULES.find(([pattern]) => pattern.test(slug))?.[1] ?? Tag;
}

// E2: previously plain bordered text boxes — no icon, no visual identity, and (like ProductCard)
// the <Link> had no style reset so the label rendered as a raw underlined hyperlink. Now a small
// category icon + label, same fix for the anchor styling.
export function CategoryGrid({ categories }: CategoryGridProps) {
  const { language } = useLanguage();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--sp-3)' }}>
      {categories.map((category) => {
        const Icon = iconFor(category.slug);
        return (
          <Link
            key={category.id}
            to={`/category/${category.slug}`}
            className="karobarai-category-tile"
            style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
          >
            <Card
              hoverable
              size="small"
              styles={{
                body: {
                  padding: 'var(--sp-3)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--sp-2)',
                  textAlign: 'center',
                },
              }}
            >
              <Icon className="karobarai-category-tile-icon" size={22} strokeWidth={1.75} color="var(--text-secondary)" aria-hidden="true" />
              <Typography.Text style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                {language === 'UR' ? category.nameUr : category.nameEn}
              </Typography.Text>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
