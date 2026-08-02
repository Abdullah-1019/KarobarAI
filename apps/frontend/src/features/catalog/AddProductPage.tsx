import { useState } from 'react';
import { Alert, Button, Input, InputNumber, Select, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { createProductSchema, type CategoryDTO } from '@karobarai/shared';
import { SkeletonLoader } from '../../components';
import { CATEGORIES_QUERY_KEY, createProduct, getCategories } from './catalogApi';
import { formatCatalogError } from './catalogErrors';

interface FormValues {
  titleEn: string;
  price: number | null;
  categoryId: string | undefined;
}

// Flattens the category tree into a single-level picker — currently flat anyway (no parent
// categories seeded yet per F4-catalog-backend.md) but tree-ready regardless.
function flattenCategories(categories: CategoryDTO[], depth = 0): { id: string; label: string }[] {
  return categories.flatMap((c) => [
    { id: c.id, label: `${'— '.repeat(depth)}${c.nameEn}` },
    ...flattenCategories(c.children, depth + 1),
  ]);
}

// SCR-S02's manual "Add Product" path. Task 3.3's NOT NULL constraint (titleEn + price both
// required, no DB default) means a Draft can't be created with zero fields despite App Flow's
// "upload photo first" framing — this form collects the minimum, then the Edit screen (images,
// AI generation, publish) takes over.
export function AddProductPage() {
  const { t } = useTranslation(['catalog', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: categories, isPending: categoriesPending } = useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: getCategories,
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { titleEn: '', price: null, categoryId: undefined } });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const payload = {
      titleEn: values.titleEn,
      price: values.price ?? 0,
      categoryId: values.categoryId,
    };

    const parsed = createProductSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
        setError(field, { message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      const product = await createProduct(parsed.data);
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'seller-products'] });
      navigate(`/seller/products/${product.id}/edit`);
    } catch (err) {
      setSubmitError(formatCatalogError(t, err));
    } finally {
      setSubmitting(false);
    }
  });

  const categoryOptions = categories ? flattenCategories(categories).map((c) => ({ value: c.id, label: c.label })) : [];

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Link to="/seller">← {t('catalog:productsList.title')}</Link>
      <Typography.Title level={3}>{t('catalog:addProduct.title')}</Typography.Title>

      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 16 }} />}

      {categoriesPending ? (
        <SkeletonLoader rows={3} />
      ) : (
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label>{t('catalog:addProduct.titleLabel')}</label>
            <Controller
              name="titleEn"
              control={control}
              render={({ field }) => <Input {...field} size="large" />}
            />
            {errors.titleEn && <Typography.Text type="danger">{errors.titleEn.message}</Typography.Text>}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>{t('catalog:addProduct.priceLabel')}</label>
            <Controller
              name="price"
              control={control}
              render={({ field }) => (
                <InputNumber {...field} size="large" min={0} style={{ width: '100%' }} />
              )}
            />
            {errors.price && <Typography.Text type="danger">{errors.price.message}</Typography.Text>}
          </div>

          <div style={{ marginBottom: 24 }}>
            <label>{t('catalog:addProduct.categoryLabel')}</label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  size="large"
                  style={{ width: '100%' }}
                  allowClear
                  options={categoryOptions}
                  placeholder={t('catalog:addProduct.categoryPlaceholder')}
                />
              )}
            />
          </div>

          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            {t('catalog:addProduct.submit')}
          </Button>
        </form>
      )}
    </div>
  );
}
