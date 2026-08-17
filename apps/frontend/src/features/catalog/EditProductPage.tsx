import { useEffect, useState } from 'react';
import { Alert, Button, Input, InputNumber, Select, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { updateProductSchema, type CategoryDTO, type ProductCondition } from '@karobarai/shared';
import { ApiError } from '../../api';
import { AIHint, AIRevealPanel, AIStatus, BackLink, BilingualField, EmptyState, Modal, SkeletonLoader, toast } from '../../components';
import {
  CATEGORIES_QUERY_KEY,
  deleteProduct,
  generateListing,
  getCategories,
  getProduct,
  productQueryKey,
  publishProduct,
  unpublishProduct,
  updateProduct,
} from './catalogApi';
import { formatCatalogError } from './catalogErrors';
import { ProductImageManager } from './ProductImageManager';
import { ProductStatusTag } from './ProductStatusTag';

interface FormValues {
  titleEn: string;
  titleUr: string;
  descriptionEn: string;
  descriptionUr: string;
  price: number | null;
  stock: number | null;
  condition: ProductCondition;
  categoryId: string | undefined;
  tags: string[];
}

const CONDITIONS: ProductCondition[] = ['NEW', 'LIKE_NEW', 'USED', 'REFURBISHED'];

function flattenCategories(categories: CategoryDTO[], depth = 0): { id: string; label: string }[] {
  return categories.flatMap((c) => [
    { id: c.id, label: `${'— '.repeat(depth)}${c.nameEn}` },
    ...flattenCategories(c.children, depth + 1),
  ]);
}

// SCR-S03/S04 — full product edit: business fields, images, AI generation, publish/unpublish,
// delete. Loads via the public GET /products/:id detail endpoint, which allows the owning Seller
// to preview their own Draft (F4-catalog-backend.md's "owner-preview exception"). "Generate with
// AI" here gets the same UIUX §22 treatment as AddProductPage's flagship flow (AIStatus while
// working, AIRevealPanel's staggered entrance, AIHint once done) — it's the same signature moment,
// just re-triggerable on an existing product rather than a first-time one.
export function EditProductPage() {
  const { t } = useTranslation(['catalog', 'common']);
  const { productId } = useParams<{ productId: string }>();
  const id = productId ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: product, isPending, isError, error, refetch } = useQuery({
    queryKey: productQueryKey(id),
    queryFn: () => getProduct(id),
    enabled: id !== '',
  });
  const { data: categories } = useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: getCategories });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [justRegenerated, setJustRegenerated] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      titleEn: '',
      titleUr: '',
      descriptionEn: '',
      descriptionUr: '',
      price: null,
      stock: null,
      condition: 'NEW',
      categoryId: undefined,
      tags: [],
    },
  });

  useEffect(() => {
    if (!product) return;
    reset({
      titleEn: product.titleEn,
      titleUr: product.titleUr ?? '',
      descriptionEn: product.descriptionEn ?? '',
      descriptionUr: product.descriptionUr ?? '',
      price: Number(product.price),
      stock: product.stock,
      condition: product.condition,
      categoryId: product.category?.id,
      tags: [],
    });
  }, [product, reset]);

  if (isPending) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title={t('common:state.error')}
        description={formatCatalogError(t, error)}
        actionLabel={t('common:actions.retry')}
        onAction={() => refetch()}
      />
    );
  }

  const categoryOptions = categories ? flattenCategories(categories).map((c) => ({ value: c.id, label: c.label })) : [];

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const payload = {
      titleEn: values.titleEn,
      titleUr: values.titleUr.trim() === '' ? null : values.titleUr,
      descriptionEn: values.descriptionEn.trim() === '' ? null : values.descriptionEn,
      descriptionUr: values.descriptionUr.trim() === '' ? null : values.descriptionUr,
      price: values.price ?? 0,
      stock: values.stock ?? 0,
      condition: values.condition,
      categoryId: values.categoryId ?? null,
      tags: values.tags,
    };

    const parsed = updateProductSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
        setError(field, { message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateProduct(id, parsed.data);
      queryClient.setQueryData(productQueryKey(id), updated);
      toast.success(t('catalog:editProduct.saved'));
    } catch (err) {
      setSubmitError(formatCatalogError(t, err));
    } finally {
      setSubmitting(false);
    }
  });

  async function handleGenerate() {
    setGenerateError(null);
    setGenerating(true);
    try {
      const updated = await generateListing(id);
      queryClient.setQueryData(productQueryKey(id), updated);
      setJustRegenerated(true);
      setRevealKey((k) => k + 1);
      toast.success(t('catalog:editProduct.generateSuccess'));
    } catch (err) {
      setGenerateError(formatCatalogError(t, err));
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublishToggle() {
    setPublishError(null);
    setPublishing(true);
    try {
      const updated = product!.status === 'LIVE' ? await unpublishProduct(id) : await publishProduct(id);
      queryClient.setQueryData(productQueryKey(id), updated);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PUBLISH_REQUIREMENTS_NOT_MET') {
        const missing = (err.details as { missing?: string[] } | undefined)?.missing ?? [];
        setPublishError(
          `${formatCatalogError(t, err)}${missing.length ? ` (${missing.join(', ')})` : ''}`,
        );
      } else {
        setPublishError(formatCatalogError(t, err));
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteProduct(id);
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'seller-products'] });
      navigate('/seller');
    } catch (err) {
      toast.error(formatCatalogError(t, err));
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <BackLink to="/seller" label={t('catalog:productsList.title')} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('catalog:editProduct.title')}
        </Typography.Title>
        <ProductStatusTag status={product.status} />
      </div>

      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <Typography.Title level={5}>{t('catalog:editProduct.imagesTitle')}</Typography.Title>
        <ProductImageManager productId={id} images={product.images} />
      </div>

      <div style={{ marginBottom: 'var(--sp-6)' }}>
        {generating ? (
          <AIStatus message={t('catalog:aiWizard.generating')} />
        ) : (
          <Button loading={generating} onClick={handleGenerate}>
            {t('catalog:editProduct.generateListing')}
          </Button>
        )}
        {generateError && <Alert type="error" message={generateError} showIcon style={{ marginTop: 'var(--sp-2)' }} />}
      </div>

      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 'var(--sp-4)' }} />}

      <form onSubmit={onSubmit}>
        {justRegenerated && (
          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <AIHint label={t('catalog:aiWizard.editAnythingHint')} />
          </div>
        )}

        <AIRevealPanel revealKey={revealKey}>
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <BilingualField
              enLabel={t('catalog:editProduct.titleEnLabel')}
              urLabel={t('catalog:editProduct.titleUrLabel')}
              enField={<Controller name="titleEn" control={control} render={({ field }) => <Input {...field} size="large" />} />}
              urField={<Controller name="titleUr" control={control} render={({ field }) => <Input {...field} size="large" dir="rtl" />} />}
            />
            {errors.titleEn && <Typography.Text type="danger">{errors.titleEn.message}</Typography.Text>}
          </div>

          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <BilingualField
              enLabel={t('catalog:editProduct.descriptionEnLabel')}
              urLabel={t('catalog:editProduct.descriptionUrLabel')}
              enField={<Controller name="descriptionEn" control={control} render={({ field }) => <Input.TextArea {...field} rows={3} />} />}
              urField={
                <Controller
                  name="descriptionUr"
                  control={control}
                  render={({ field }) => <Input.TextArea {...field} rows={3} dir="rtl" />}
                />
              }
            />
          </div>
        </AIRevealPanel>

        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <div style={{ flex: 1 }}>
            <label>{t('catalog:editProduct.priceLabel')}</label>
            <Controller
              name="price"
              control={control}
              render={({ field }) => <InputNumber {...field} size="large" min={0} style={{ width: '100%' }} />}
            />
            {errors.price && <Typography.Text type="danger">{errors.price.message}</Typography.Text>}
          </div>
          <div style={{ flex: 1 }}>
            <label>{t('catalog:editProduct.stockLabel')}</label>
            <Controller
              name="stock"
              control={control}
              render={({ field }) => <InputNumber {...field} size="large" min={0} style={{ width: '100%' }} />}
            />
            {errors.stock && <Typography.Text type="danger">{errors.stock.message}</Typography.Text>}
          </div>
        </div>

        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label>{t('catalog:editProduct.conditionLabel')}</label>
          <Controller
            name="condition"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                size="large"
                style={{ width: '100%' }}
                options={CONDITIONS.map((c) => ({ value: c, label: t(`catalog:condition.${c}`) }))}
              />
            )}
          />
        </div>

        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label>{t('catalog:editProduct.categoryLabel')}</label>
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <Select {...field} size="large" style={{ width: '100%' }} allowClear options={categoryOptions} />
            )}
          />
        </div>

        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <label>{t('catalog:editProduct.tagsLabel')}</label>
          <Controller
            name="tags"
            control={control}
            render={({ field }) => <Select {...field} mode="tags" size="large" style={{ width: '100%' }} open={false} />}
          />
        </div>

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          {t('catalog:editProduct.save')}
        </Button>
      </form>

      <div style={{ marginTop: 'var(--sp-8)', paddingTop: 'var(--sp-6)', borderTop: '1px solid var(--border)' }}>
        {publishError && <Alert type="error" message={publishError} showIcon style={{ marginBottom: 'var(--sp-3)' }} />}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <Button loading={publishing} onClick={handlePublishToggle}>
            {product.status === 'LIVE' ? t('catalog:editProduct.unpublish') : t('catalog:editProduct.publish')}
          </Button>
          <Button danger onClick={() => setDeleteModalOpen(true)}>
            {t('catalog:editProduct.delete')}
          </Button>
          <Link to="/seller/products/new" style={{ marginInlineStart: 'auto' }}>
            <Button>{t('catalog:productsList.addProduct')}</Button>
          </Link>
        </div>
      </div>

      <Modal
        open={deleteModalOpen}
        title={t('catalog:editProduct.deleteConfirmTitle')}
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDelete}
        okButtonProps={{ danger: true, loading: deleting }}
      >
        {t('catalog:editProduct.deleteConfirmContent')}
      </Modal>
    </div>
  );
}
