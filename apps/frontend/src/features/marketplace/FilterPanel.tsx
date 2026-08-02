import { Button, InputNumber, Select, Space, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import type { CategoryDTO, ProductCondition } from '@karobarai/shared';
import type { SearchParams, SortOption } from './marketplaceApi';

interface FilterPanelProps {
  categories: CategoryDTO[];
  value: Omit<SearchParams, 'q'>;
  onChange: (next: Omit<SearchParams, 'q'>) => void;
  onReset: () => void;
  showCategory?: boolean;
}

// Currently flat anyway (no parent categories seeded yet per F4-catalog-backend.md) but
// tree-ready regardless — same helper shape as AddProductPage.tsx's flattenCategories.
function flattenCategories(categories: CategoryDTO[], depth = 0): { id: string; label: string }[] {
  return categories.flatMap((c) => [
    { id: c.id, label: `${'— '.repeat(depth)}${c.nameEn}` },
    ...flattenCategories(c.children, depth + 1),
  ]);
}

const CONDITIONS: ProductCondition[] = ['NEW', 'LIKE_NEW', 'USED', 'REFURBISHED'];

// SCR-B02's filter panel. Seller-rating sort is rendered but disabled with a tooltip — same
// disabled-stub convention F4 already established for the seller-rating filter (blocked on the
// future Reviews feature), not something this feature invents.
export function FilterPanel({ categories, value, onChange, onReset, showCategory = true }: FilterPanelProps) {
  const { t } = useTranslation('marketplace');
  const categoryOptions = flattenCategories(categories).map((c) => ({ value: c.id, label: c.label }));

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {showCategory && (
        <div>
          <Typography.Text strong>{t('filters.category')}</Typography.Text>
          <Select
            allowClear
            style={{ width: '100%', marginTop: 4 }}
            placeholder={t('filters.allCategories')}
            options={categoryOptions}
            value={value.categoryId}
            onChange={(categoryId) => onChange({ ...value, categoryId })}
          />
        </div>
      )}

      <div>
        <Typography.Text strong>{t('filters.priceRange')}</Typography.Text>
        <Space style={{ marginTop: 4 }}>
          <InputNumber
            min={0}
            placeholder={t('filters.minPrice')}
            value={value.minPrice}
            onChange={(minPrice) => onChange({ ...value, minPrice: minPrice ?? undefined })}
          />
          <InputNumber
            min={0}
            placeholder={t('filters.maxPrice')}
            value={value.maxPrice}
            onChange={(maxPrice) => onChange({ ...value, maxPrice: maxPrice ?? undefined })}
          />
        </Space>
      </div>

      <div>
        <Typography.Text strong>{t('filters.condition')}</Typography.Text>
        <Select
          allowClear
          style={{ width: '100%', marginTop: 4 }}
          value={value.condition}
          onChange={(condition) => onChange({ ...value, condition })}
          options={CONDITIONS.map((c) => ({ value: c, label: t(`condition.${c}`) }))}
        />
      </div>

      <div>
        <Typography.Text strong>{t('filters.sort')}</Typography.Text>
        <Select
          style={{ width: '100%', marginTop: 4 }}
          value={value.sort ?? 'relevance'}
          onChange={(sort: SortOption) => onChange({ ...value, sort })}
          options={[
            { value: 'relevance', label: t('filters.sortRelevance') },
            { value: 'price_asc', label: t('filters.sortPriceAsc') },
            { value: 'price_desc', label: t('filters.sortPriceDesc') },
            { value: 'newest', label: t('filters.sortNewest') },
            {
              value: 'rating',
              disabled: true,
              label: (
                <Tooltip title={t('filters.sortRating')}>
                  <span>{t('filters.sortRating')}</span>
                </Tooltip>
              ),
            },
          ]}
        />
      </div>

      <Button block onClick={onReset}>
        {t('search.resetFilters')}
      </Button>
    </Space>
  );
}
