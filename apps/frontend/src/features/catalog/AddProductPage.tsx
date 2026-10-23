import { useRef, useState } from 'react';
import { Alert, Button, Input, InputNumber, Select } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';
import { Camera, Check, ImagePlus, Loader2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { aiSaveProductSchema, type AiStagedImageDTO, type CategoryDTO, type ProductCondition } from '@karobarai/shared';
import { AIFieldBadge, AIHint, AIRevealPanel, AIStatus, AiMark, BilingualField, PriceDisplay, toast } from '../../components';
import { ApiError } from '../../api';
import { CATEGORIES_QUERY_KEY, getCategories } from './catalogApi';
import { formatCatalogError } from './catalogErrors';
import { generateDraft, saveAiProduct, uploadStagingImages } from './aiStoreBuilderApi';

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
const EMPTY_VALUES: FormValues = {
  titleEn: '',
  titleUr: '',
  descriptionEn: '',
  descriptionUr: '',
  price: null,
  stock: null,
  condition: 'NEW',
  categoryId: undefined,
  tags: [],
};
const STEPS = ['stepPhoto', 'stepWrite', 'stepReview'] as const;

// Client-side compression before upload (REQ-F-Store007, <200KB target).
const COMPRESSION_OPTIONS = { maxSizeMB: 0.2, maxWidthOrHeight: 1920, useWebWorker: true };

function flattenCategories(categories: CategoryDTO[], depth = 0): { id: string; label: string }[] {
  return categories.flatMap((c) => [
    { id: c.id, label: `${'— '.repeat(depth)}${c.nameEn}` },
    ...flattenCategories(c.children, depth + 1),
  ]);
}

// SCR-S02 (flagship) — the AI Store Builder: photo(s) -> AI-generated bilingual listing ->
// check -> Publish/Save Draft. Backend flow (F13-ai-store-builder.md): upload stages image(s)
// under a stagingId (no product row yet) -> generate calls the AI Service against that staging ->
// save creates the product, promotes the images and optionally publishes. AI failure never blocks
// the flow (REQ-F-Store005): the form still works for manual entry through the same save call.
//
// Studio Light layout: a three-step tracker, one big photo drop zone, then a two-column workspace —
// the listing sections on one side, the photos (with the AI scan while it writes) and a live buyer
// preview on the other — with a sticky action bar. Price/stock/condition are never AI-filled (a
// business decision), so only the listing section takes part in the reveal.
export function AddProductPage() {
  const { t } = useTranslation(['catalog', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: getCategories });

  const [stagingId, setStagingId] = useState<string | null>(null);
  const [stagedImages, setStagedImages] = useState<AiStagedImageDTO[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateErrorCode, setGenerateErrorCode] = useState<string | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [categoryGuess, setCategoryGuess] = useState<string | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<'DRAFT' | 'LIVE' | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({ defaultValues: EMPTY_VALUES });

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      const compressed = await Promise.all(
        files.map(async (file) => {
          try {
            return await imageCompression(file, COMPRESSION_OPTIONS);
          } catch {
            // Best-effort: an unsupported/corrupt file still gets server-side validation.
            return file;
          }
        }),
      );
      const result = await uploadStagingImages(compressed);
      setStagingId(result.stagingId);
      setStagedImages(result.images);
      setActiveImage(0);
      void handleGenerate(result.stagingId);
    } catch (err) {
      setUploadError(formatCatalogError(t, err));
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate(id: string) {
    setGenerateError(null);
    setGenerateErrorCode(null);
    setGenerating(true);
    try {
      const result = await generateDraft(id);
      reset({
        titleEn: result.draft.titleEn,
        titleUr: result.draft.titleUr,
        descriptionEn: result.draft.descriptionEn,
        descriptionUr: result.draft.descriptionUr,
        price: null,
        stock: null,
        condition: 'NEW',
        categoryId: result.draft.categoryId ?? undefined,
        tags: result.draft.tags,
      });
      setCategoryGuess(result.draft.categoryId ? null : result.draft.categoryGuess);
      setAiGenerated(true);
      setRevealKey((k) => k + 1);
      toast.success(t('catalog:aiWizard.generateSuccess'));
    } catch (err) {
      setGenerateError(formatCatalogError(t, err));
      setGenerateErrorCode(err instanceof ApiError ? err.code : null);
      setAiGenerated(false);
    } finally {
      setGenerating(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (!uploading) handleFiles(Array.from(event.dataTransfer.files));
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    handleFiles(files);
  }

  const categoryOptions = categories ? flattenCategories(categories).map((c) => ({ value: c.id, label: c.label })) : [];
  const formLocked = generating || savingStatus !== null;
  const step = !stagingId ? 0 : generating ? 1 : 2;

  const previewTitle = watch('titleEn').trim();
  const previewTitleUr = watch('titleUr').trim();
  const previewPrice = watch('price');
  const previewCondition = watch('condition');

  function saveWith(status: 'DRAFT' | 'LIVE') {
    return handleSubmit(async (values) => {
      if (!stagingId) return;
      setSubmitError(null);

      const payload = {
        stagingId,
        titleEn: values.titleEn,
        titleUr: values.titleUr.trim() === '' ? null : values.titleUr,
        descriptionEn: values.descriptionEn.trim() === '' ? null : values.descriptionEn,
        descriptionUr: values.descriptionUr.trim() === '' ? null : values.descriptionUr,
        price: values.price ?? 0,
        stock: values.stock ?? 0,
        condition: values.condition,
        categoryId: values.categoryId ?? null,
        tags: values.tags,
        status,
        aiGenerated,
      };

      const parsed = aiSaveProductSchema.safeParse(payload);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path[0] as keyof FormValues;
          setError(field, { message: issue.message });
        }
        return;
      }

      setSavingStatus(status);
      try {
        const product = await saveAiProduct(parsed.data);
        await queryClient.invalidateQueries({ queryKey: ['catalog', 'seller-products'] });
        navigate(status === 'LIVE' ? `/product/${product.id}` : '/seller');
      } catch (err) {
        if (err instanceof ApiError && err.code === 'PUBLISH_REQUIREMENTS_NOT_MET') {
          const missing = (err.details as { missing?: string[] } | undefined)?.missing ?? [];
          setSubmitError(`${formatCatalogError(t, err)}${missing.length ? ` (${missing.join(', ')})` : ''}`);
        } else {
          setSubmitError(formatCatalogError(t, err));
        }
      } finally {
        setSavingStatus(null);
      }
    });
  }

  const fieldError = (message?: string) => (message ? <p className="slFieldError">{message}</p> : null);
  const aiBadge = (dirty?: boolean | boolean[]) => (
    <AIFieldBadge show={aiGenerated && !(Array.isArray(dirty) ? dirty.some(Boolean) : dirty)} label={t('catalog:aiWizard.fieldUneditedHint')} />
  );
  const mainImage = stagedImages[activeImage] ?? stagedImages[0];

  return (
    <div className="slBuilder">
      <header className="slBuilderHead">
        <div>
          <h1 className="slWizardTitle">{t('catalog:aiWizard.title')}</h1>
          <p className="slWizardSub">{t('catalog:aiWizard.subtitle')}</p>
        </div>
        <ol className="slSteps slSteps--compact">
          {STEPS.map((key, index) => (
            <li
              key={key}
              className="slStep"
              data-state={index < step ? 'done' : index === step ? 'current' : undefined}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="slStepDot" aria-hidden="true">
                {index < step ? <Check size={14} strokeWidth={3} /> : index + 1}
              </span>
              <span className="slStepLabel">{t(`catalog:aiWizard.${key}`)}</span>
            </li>
          ))}
        </ol>
      </header>

      {!stagingId && (
        <div
          className="slDrop"
          data-over={dragOver || undefined}
          data-busy={uploading || undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <span className="slDropArt" aria-hidden="true">
            <span className="slDropCard slDropCard--back" />
            <span className="slDropCard">
              {uploading ? <Loader2 size={28} className="slSpin" /> : <ImagePlus size={28} />}
            </span>
            <span className="slDropChip">
              <AiMark size={12} color="var(--ai-accent)" />
              AI
            </span>
          </span>

          <p className="slDropTitle" aria-live="polite">
            {uploading
              ? t('catalog:aiWizard.uploading')
              : dragOver
                ? t('catalog:aiWizard.dropTitleActive')
                : t('catalog:aiWizard.dropTitle')}
          </p>
          <p className="slDropHelp">{t('catalog:aiWizard.dropzoneHelp')}</p>

          <div className="slDropActions">
            <Button
              type="primary"
              shape="round"
              icon={<ImagePlus size={18} aria-hidden="true" />}
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {t('catalog:aiWizard.choosePhotos')}
            </Button>
            <Button
              className="slOnlyTouch"
              shape="round"
              icon={<Camera size={18} aria-hidden="true" />}
              disabled={uploading}
              onClick={() => cameraInputRef.current?.click()}
            >
              {t('catalog:aiWizard.takePhoto')}
            </Button>
          </div>
          <p className="slDropNote">
            {t('catalog:aiWizard.oneShotNote')}<br />
            {t('catalog:aiWizard.formats')}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={handleFileInputChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            hidden
            onChange={handleFileInputChange}
          />
        </div>
      )}

      {uploadError && <Alert type="error" message={uploadError} showIcon className="slBuilderAlert" />}

      {stagingId && (
        <div className="slWork">
          <div className="slWorkMain">
            {generating && <AIStatus message={t('catalog:aiWizard.generating')} shape="listing" />}

            {generateError && !generating && (
              <Alert
                type="warning"
                showIcon
                message={generateError}
                description={t('catalog:aiWizard.generateFailedHint')}
                action={
                  stagingId &&
                  generateErrorCode !== 'AI_IMAGE_NOT_IDENTIFIABLE' && (
                    <Button size="small" shape="round" onClick={() => handleGenerate(stagingId)}>
                      {t('catalog:aiWizard.retry')}
                    </Button>
                  )
                }
                className="slBuilderAlert"
              />
            )}

            {!generating && (
              <fieldset disabled={formLocked} className="slFieldset">
                {submitError && <Alert type="error" message={submitError} showIcon className="slBuilderAlert" />}

                <section className="slFormCard" data-ai={aiGenerated || undefined}>
                  <div className="slFormCardHead">
                    <h2 className="slPanelTitle">{t('catalog:aiWizard.sectionListing')}</h2>
                    {aiGenerated && <AIHint label={t('catalog:aiWizard.editAnythingHint')} />}
                  </div>

                  <AIRevealPanel revealKey={revealKey}>
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
                        <label htmlFor="add-product-category">
                          {t('catalog:editProduct.categoryLabel')}
                          {aiBadge(dirtyFields.categoryId)}
                        </label>
                        <Controller
                          name="categoryId"
                          control={control}
                          render={({ field }) => (
                            <Select {...field} id="add-product-category" size="large" style={{ width: '100%' }} allowClear options={categoryOptions} />
                          )}
                        />
                        {categoryGuess && <p className="slFieldHint">{t('catalog:aiWizard.categoryGuessHint', { guess: categoryGuess })}</p>}
                      </div>
                      <div className="slField">
                        <label htmlFor="add-product-tags">
                          {t('catalog:editProduct.tagsLabel')}
                          {aiBadge(dirtyFields.tags)}
                        </label>
                        <Controller
                          name="tags"
                          control={control}
                          render={({ field }) => (
                            <Select {...field} id="add-product-tags" mode="tags" size="large" style={{ width: '100%' }} open={false} />
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
                      <label htmlFor="add-product-price">{t('catalog:editProduct.priceLabel')}</label>
                      <Controller
                        name="price"
                        control={control}
                        render={({ field }) => (
                          <InputNumber {...field} id="add-product-price" size="large" min={0} prefix="Rs" style={{ width: '100%' }} />
                        )}
                      />
                      {fieldError(errors.price?.message)}
                    </div>
                    <div className="slField">
                      <label htmlFor="add-product-stock">{t('catalog:editProduct.stockLabel')}</label>
                      <Controller
                        name="stock"
                        control={control}
                        render={({ field }) => <InputNumber {...field} id="add-product-stock" size="large" min={0} style={{ width: '100%' }} />}
                      />
                      {fieldError(errors.stock?.message)}
                    </div>
                    <div className="slField">
                      <label htmlFor="add-product-condition">{t('catalog:editProduct.conditionLabel')}</label>
                      <Controller
                        name="condition"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            id="add-product-condition"
                            size="large"
                            style={{ width: '100%' }}
                            options={CONDITIONS.map((c) => ({ value: c, label: t(`catalog:condition.${c}`) }))}
                          />
                        )}
                      />
                    </div>
                  </div>
                </section>

                <div className="slActionBar">
                  <Button shape="round" loading={savingStatus === 'DRAFT'} onClick={saveWith('DRAFT')}>
                    {t('catalog:aiWizard.saveDraft')}
                  </Button>
                  <Button type="primary" shape="round" loading={savingStatus === 'LIVE'} onClick={saveWith('LIVE')}>
                    {t('catalog:aiWizard.publish')}
                  </Button>
                </div>
              </fieldset>
            )}
          </div>

          <aside className="slWorkSide">
            <section className="slFormCard slPhotos" aria-label={t('catalog:aiWizard.photosTitle')}>
              <div className="slPhotoMain" data-scanning={generating || undefined}>
                {mainImage && <img src={mainImage.cdnUrl} alt="" />}
                {mainImage?.position === 0 && <span className="slPhotoBadge">{t('catalog:editProduct.primaryBadge')}</span>}
                {generating && <span className="slPhotoScan" aria-hidden="true" />}
              </div>
              {stagedImages.length > 1 && (
                <div className="slThumbs">
                  {stagedImages.map((img, index) => (
                    <button
                      key={img.position}
                      type="button"
                      className="slThumb"
                      aria-pressed={index === activeImage}
                      aria-label={`${index + 1} / ${stagedImages.length}`}
                      onClick={() => setActiveImage(index)}
                    >
                      <img src={img.cdnUrl} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="slFormCard slBuyerPreview" aria-label={t('catalog:aiWizard.previewTitle')}>
              <span className="slPreviewLabel">{t('catalog:aiWizard.previewTitle')}</span>
              <div className="slBuyerCard">
                <span className="slBuyerImg">{stagedImages[0] && <img src={stagedImages[0].cdnUrl} alt="" />}</span>
                <span className="slBuyerTitle" data-empty={!previewTitle || undefined}>
                  {previewTitle || t('catalog:aiWizard.previewEmptyTitle')}
                </span>
                {previewTitleUr && (
                  <span className="slBuyerTitleUr" lang="ur" dir="rtl">
                    {previewTitleUr}
                  </span>
                )}
                <span className="slBuyerFoot">
                  {previewPrice != null ? <PriceDisplay amount={previewPrice} size="sm" /> : <span className="slBuyerDash">Rs –</span>}
                  <span className="slBuyerCond">{t(`catalog:condition.${previewCondition}`)}</span>
                </span>
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
