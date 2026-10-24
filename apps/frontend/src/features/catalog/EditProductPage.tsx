import { useEffect, useState } from 'react';
import { Alert, Button, Input, InputNumber, Select } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { updateProductSchema, type CategoryDTO, type ProductCondition } from '@karobarai/shared';
import { ApiError } from '../../api';
import {
  AIFieldBadge,
  AIHint,
  AIRevealPanel,
  AIStatus,
  AiMark,
  BilingualField,
  EmptyState,
  Modal,
  SkeletonLoader,
  toast,
} from '../../components';
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
import { ProductVariantsEditor } from './ProductVariantsEditor';

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
    formState: { errors, dirtyFields },
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
  const hasVariants = (product?.variants?.length ?? 0) > 0;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const payload = {
      titleEn: values.titleEn,
      titleUr: values.titleUr.trim() === '' ? null : values.titleUr,
      descriptionEn: values.descriptionEn.trim() === '' ? null : values.descriptionEn,
      descriptionUr: values.descriptionUr.trim() === '' ? null : values.descriptionUr,
      price: values.price ?? 0,
      // Feature 23 — with sizes/colours the stock is their total, saved in the variants card.
      ...(hasVariants ? {} : { stock: values.stock ?? 0 }),
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

  const fieldError = (message?: string) => (message ? <p className="slFieldError">{message}</p> : null);
  const aiBadge = (dirty?: boolean) => (
    <AIFieldBadge show={justRegenerated && !dirty} label={t('catalog:aiWizard.fieldUneditedHint')} />
  );

  // Studio Light: the same two-column workspace as the AI Store Builder — listing + pricing on one
  // side, images and the publish/delete controls on the other, Save in a sticky glass bar.
  // Delete stays a quiet text action, separated from everyday ones; the confirm modal guards it.
  return (
    <div className="slBuilder">
      <header className="slBuilderHead">
        <div className="slEditTitle">
          <h1 className="slWizardTitle">{t('catalog:editProduct.title')}</h1>
          <ProductStatusTag status={product.status} />
        </div>
        <div className="slEditActions">
          <Link to="/seller/products/new" className="slGhostBtn">
            {t('catalog:productsList.addProduct')}
          </Link>
          <Button
            shape="round"
            type={product.status === 'LIVE' ? 'default' : 'primary'}
            loading={publishing}
            onClick={handlePublishToggle}
          >
            {product.status === 'LIVE' ? t('catalog:editProduct.unpublish') : t('catalog:editProduct.publish')}
          </Button>
        </div>
      </header>

      {publishError && <Alert type="error" message={publishError} showIcon />}

      <div className="slWork">
        <form onSubmit={onSubmit} className="slFieldset">
          {submitError && <Alert type="error" message={submitError} showIcon />}

          <section className="slFormCard" data-ai={justRegenerated || undefined}>
            <div className="slFormCardHead">
              <h2 className="slPanelTitle">{t('catalog:aiWizard.sectionListing')}</h2>
              {justRegenerated ? (
                <AIHint label={t('catalog:aiWizard.editAnythingHint')} />
              ) : (
                !generating && (
                  <Button shape="round" icon={<AiMark size={14} color="var(--ai-accent)" />} onClick={handleGenerate}>
                    {t('catalog:editProduct.generateListing')}
                  </Button>
                )
              )}
            </div>
            {generating && (
              <div className="slBuilderAlert">
                <AIStatus message={t('catalog:aiWizard.generating')} />
              </div>
            )}
            {generateError && <Alert type="error" message={generateError} showIcon className="slBuilderAlert" />}

            <AIRevealPanel revealKey={revealKey} fast>
              <div className="slField">
                <BilingualField
                  enLabel={
                    <>
                      {t('catalog:editProduct.titleEnLabel')}
                      {aiBadge(dirtyFields.titleEn)}
                    </>
                  }
                  urLabel={
                    <>
                      {t('catalog:editProduct.titleUrLabel')}
                      {aiBadge(dirtyFields.titleUr)}
                    </>
                  }
                  enField={<Controller name="titleEn" control={control} render={({ field }) => <Input {...field} size="large" />} />}
                  urField={<Controller name="titleUr" control={control} render={({ field }) => <Input {...field} size="large" dir="rtl" />} />}
                />
                {fieldError(errors.titleEn?.message)}
              </div>

              <div className="slField">
                <BilingualField
                  enLabel={
                    <>
                      {t('catalog:editProduct.descriptionEnLabel')}
                      {aiBadge(dirtyFields.descriptionEn)}
                    </>
                  }
                  urLabel={
                    <>
                      {t('catalog:editProduct.descriptionUrLabel')}
                      {aiBadge(dirtyFields.descriptionUr)}
                    </>
                  }
                  enField={<Controller name="descriptionEn" control={control} render={({ field }) => <Input.TextArea {...field} rows={4} />} />}
                  urField={
                    <Controller
                      name="descriptionUr"
                      control={control}
                      render={({ field }) => <Input.TextArea {...field} rows={4} dir="rtl" />}
                    />
                  }
                />
              </div>

              <div className="slFieldRow">
                <div className="slField">
                  <label htmlFor="edit-product-category">{t('catalog:editProduct.categoryLabel')}</label>
                  <Controller
                    name="categoryId"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} id="edit-product-category" size="large" style={{ width: '100%' }} allowClear options={categoryOptions} />
                    )}
                  />
                </div>
                <div className="slField">
                  <label htmlFor="edit-product-tags">{t('catalog:editProduct.tagsLabel')}</label>
                  <Controller
                    name="tags"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} id="edit-product-tags" mode="tags" size="large" style={{ width: '100%' }} open={false} />
                    )}
                  />
                </div>
              </div>
            </AIRevealPanel>
          </section>

          <section className="slFormCard">
            <div className="slFormCardHead">
              <h2 className="slPanelTitle">{t('catalog:aiWizard.sectionPricing')}</h2>
            </div>
            <div className="slFieldRow slFieldRow--3">
              <div className="slField">
                <label htmlFor="edit-product-price">{t('catalog:editProduct.priceLabel')}</label>
                <Controller
                  name="price"
                  control={control}
                  render={({ field }) => (
                    <InputNumber {...field} id="edit-product-price" size="large" min={0} prefix="Rs" style={{ width: '100%' }} />
                  )}
                />
                {fieldError(errors.price?.message)}
              </div>
              <div className="slField">
                <label htmlFor="edit-product-stock">{t('catalog:editProduct.stockLabel')}</label>
                <Controller
                  name="stock"
                  control={control}
                  render={({ field }) => (
                    <InputNumber
                      {...field}
                      id="edit-product-stock"
                      size="large"
                      min={0}
                      disabled={hasVariants}
                      aria-describedby={hasVariants ? 'edit-product-stock-note' : undefined}
                      style={{ width: '100%' }}
                    />
                  )}
                />
                {hasVariants && (
                  <small id="edit-product-stock-note" className="pve-hint">
                    {t('catalog:variants.stockFromVariants')}
                  </small>
                )}
                {fieldError(errors.stock?.message)}
              </div>
              <div className="slField">
                <label htmlFor="edit-product-condition">{t('catalog:editProduct.conditionLabel')}</label>
                <Controller
                  name="condition"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      id="edit-product-condition"
                      size="large"
                      style={{ width: '100%' }}
                      options={CONDITIONS.map((c) => ({ value: c, label: t(`catalog:condition.${c}`) }))}
                    />
                  )}
                />
              </div>
            </div>
          </section>

          <ProductVariantsEditor productId={id} variants={product.variants ?? []} />

          <div className="slActionBar">
            <Button type="primary" htmlType="submit" shape="round" loading={submitting}>
              {t('catalog:editProduct.save')}
            </Button>
          </div>
        </form>

        <aside className="slWorkSide">
          <section className="slFormCard">
            <div className="slFormCardHead">
              <h2 className="slPanelTitle">{t('catalog:editProduct.imagesTitle')}</h2>
            </div>
            <ProductImageManager productId={id} images={product.images} />
          </section>
          <Button type="text" danger className="slDangerLink" onClick={() => setDeleteModalOpen(true)}>
            {t('catalog:editProduct.delete')}
          </Button>
        </aside>
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
