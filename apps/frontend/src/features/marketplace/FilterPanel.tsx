import { InputNumber, Select } from 'antd';
import { useTranslation } from 'react-i18next';

import type { CategoryDTO, ProductCondition } from '@karobarai/shared';
import { useLanguage } from '../../hooks';
import type { SearchParams } from './marketplaceApi';

export type BrowseFilters = Omit<SearchParams, 'q'>;

interface FilterPanelProps {
  categories: CategoryDTO[];
  value: BrowseFilters;
  onChange: (next: BrowseFilters) => void;
  showCategory?: boolean;
}

// Currently flat anyway (no parent categories seeded yet per F4-catalog-backend.md) but
// tree-ready regardless — same helper shape as AddProductPage.tsx's flattenCategories.
function flattenCategories(categories: CategoryDTO[], language: 'EN' | 'UR', depth = 0): { id: string; label: string }[] {
  return categories.flatMap((c) => [
    { id: c.id, label: `${'— '.repeat(depth)}${(language === 'UR' ? c.nameUr : c.nameEn) || c.slug}` },
    ...flattenCategories(c.children, language, depth + 1),
  ]);
}

const CONDITIONS: ProductCondition[] = ['NEW', 'LIKE_NEW', 'USED', 'REFURBISHED'];

// SCR-B02's filter panel — the same component in the desktop sidebar and the mobile bottom sheet.
// Sort lives in the results toolbar (it orders results; it doesn't narrow them), and "clear all"
// lives beside the active-filter chips, so this panel only narrows: category, price, condition.
// Condition is a row of toggle chips (one tap, visible state) rather than a dropdown.
export function FilterPanel({ categories, value, onChange, showCategory = true }: FilterPanelProps) {
  const { t } = useTranslation('marketplace');
  const { language } = useLanguage();
  const categoryOptions = flattenCategories(categories, language).map((c) => ({ value: c.id, label: c.label }));

  return (
    <div className="filter-panel">
      {showCategory && (
        <section className="filter-panel__group">
          <h2 className="filter-panel__title" id="filter-category">
            {t('filters.category')}
          </h2>
          <Select
            allowClear
            aria-labelledby="filter-category"
            style={{ width: '100%' }}
            placeholder={t('filters.allCategories')}
            options={categoryOptions}
            value={value.categoryId}
            onChange={(categoryId) => onChange({ ...value, categoryId })}
          />
        </section>
      )}

      <section className="filter-panel__group">
        <h2 className="filter-panel__title">{t('filters.priceRange')}</h2>
        <div className="filter-panel__price">
          <label className="filter-panel__field">
            <span>{t('browse.minLabel')}</span>
            <InputNumber
              min={0}
              inputMode="numeric"
              style={{ width: '100%' }}
              value={value.minPrice}
              onChange={(minPrice) => onChange({ ...value, minPrice: minPrice ?? undefined })}
            />
          </label>
          <label className="filter-panel__field">
            <span>{t('browse.maxLabel')}</span>
            <InputNumber
              min={0}
              inputMode="numeric"
              style={{ width: '100%' }}
              value={value.maxPrice}
              onChange={(maxPrice) => onChange({ ...value, maxPrice: maxPrice ?? undefined })}
            />
          </label>
        </div>
      </section>

      <section className="filter-panel__group">
        <h2 className="filter-panel__title" id="filter-condition">
          {t('filters.condition')}
        </h2>
        <div className="filter-chips" role="group" aria-labelledby="filter-condition">
          <button
            type="button"
            className="filter-chip"
            aria-pressed={!value.condition}
            onClick={() => onChange({ ...value, condition: undefined })}
          >
            {t('browse.anyCondition')}
          </button>
          {CONDITIONS.map((condition) => (
            <button
              key={condition}
              type="button"
              className="filter-chip"
              aria-pressed={value.condition === condition}
              onClick={() => onChange({ ...value, condition })}
            >
              {t(`condition.${condition}`)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
