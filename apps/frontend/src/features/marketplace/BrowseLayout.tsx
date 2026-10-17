import { useState, type ReactNode } from 'react';
import { Select } from 'antd';
import { SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CategoryDTO } from '@karobarai/shared';
import { BottomSheet, Button } from '../../components';
import { useLanguage } from '../../hooks';
import { BrowseCountSlot } from './browseSlots';
import { FilterPanel, type BrowseFilters } from './FilterPanel';
import type { SortOption } from './marketplaceApi';

interface BrowseLayoutProps {
  /** Page header (title / banner) — owns the page's single h1. */
  header: ReactNode;
  categories: CategoryDTO[];
  filters: BrowseFilters;
  onChange: (next: BrowseFilters) => void;
  onClear: () => void;
  showCategory?: boolean;
  children: ReactNode;
}

function findCategory(categories: CategoryDTO[], id: string): CategoryDTO | undefined {
  for (const category of categories) {
    if (category.id === id) return category;
    const child = findCategory(category.children, id);
    if (child) return child;
  }
  return undefined;
}

// Shared shell for Search (/search) and Category (/category/:slug) results — an Operate surface:
// a sticky filter sidebar beside the results on desktop, with the results column opening on a
// toolbar row: result count at the start, sort at the end, active filters as removable chips
// between. On phones the sidebar becomes a "Filters" bottom sheet with a single "Show results" action, so filtering never pushes the products off the screen.
export function BrowseLayout({
  header,
  categories,
  filters,
  onChange,
  onClear,
  showCategory = true,
  children,
}: BrowseLayoutProps) {
  const { t } = useTranslation('marketplace');
  const { language } = useLanguage();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [countSlot, setCountSlot] = useState<HTMLElement | null>(null);

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (showCategory && filters.categoryId) {
    const category = findCategory(categories, filters.categoryId);
    if (category) {
      chips.push({
        key: 'category',
        label: (language === 'UR' ? category.nameUr : category.nameEn) || category.slug,
        remove: () => onChange({ ...filters, categoryId: undefined }),
      });
    }
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const { minPrice: min, maxPrice: max } = filters;
    const label =
      min !== undefined && max !== undefined
        ? t('browse.priceBetween', { min, max })
        : min !== undefined
          ? t('browse.priceFrom', { min })
          : t('browse.priceUpTo', { max });
    chips.push({
      key: 'price',
      label,
      remove: () => onChange({ ...filters, minPrice: undefined, maxPrice: undefined }),
    });
  }
  if (filters.condition) {
    chips.push({
      key: 'condition',
      label: t(`condition.${filters.condition}`),
      remove: () => onChange({ ...filters, condition: undefined }),
    });
  }

  const sortSelect = (
    <label className="browse__sort">
      <span className="browse__sort-label">{t('browse.sortLabel')}</span>
      <Select
        popupMatchSelectWidth={false}
        value={filters.sort ?? 'relevance'}
        onChange={(sort: SortOption) => onChange({ ...filters, sort })}
        options={[
          { value: 'relevance', label: t('filters.sortRelevance') },
          { value: 'newest', label: t('filters.sortNewest') },
          { value: 'price_asc', label: t('filters.sortPriceAsc') },
          { value: 'price_desc', label: t('filters.sortPriceDesc') },
        ]}
      />
    </label>
  );

  return (
    <div className="browse">
      {header}

      <div className="browse__layout">
        <aside className="browse__sidebar" aria-label={t('browse.filtersTitle')}>
          <FilterPanel
            categories={categories}
            value={filters}
            onChange={onChange}
            showCategory={showCategory}
          />
        </aside>
        <div className="browse__results">
          <div className="browse__toolbar">
            <span className="browse__count-slot" ref={setCountSlot} />
            <button
              type="button"
              className="browse__filters-btn"
              onClick={() => setSheetOpen(true)}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
              {t('browse.filters')}
              {chips.length > 0 && <span className="browse__filters-count">{chips.length}</span>}
            </button>

            {chips.length > 0 && (
              <div className="browse__chips">
                <ul className="browse__chip-list" aria-label={t('browse.activeFilters')}>
                  {chips.map((chip) => (
                    <li key={chip.key}>
                      <button
                        type="button"
                        className="active-chip"
                        onClick={chip.remove}
                        aria-label={t('browse.removeFilter', { label: chip.label })}
                      >
                        {chip.label}
                        <X size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="browse__clear" onClick={onClear}>
                  {t('browse.clearAll')}
                </button>
              </div>
            )}

            {sortSelect}
          </div>
          <BrowseCountSlot.Provider value={countSlot}>{children}</BrowseCountSlot.Provider>
        </div>
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('browse.filtersTitle')}
        height="auto"
        footer={
          <div className="browse__sheet-actions">
            <Button variant="ghost" onClick={onClear}>
              {t('browse.clearAll')}
            </Button>
            <Button onClick={() => setSheetOpen(false)}>{t('browse.showResults')}</Button>
          </div>
        }
      >
        <FilterPanel
          categories={categories}
          value={filters}
          onChange={onChange}
          showCategory={showCategory}
        />
      </BottomSheet>
    </div>
  );
}
