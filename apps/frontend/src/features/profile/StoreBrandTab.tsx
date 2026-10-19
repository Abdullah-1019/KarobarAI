import { useEffect, useState } from 'react';
import { Alert, Button, Card, Input, Select, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { updateSellerProfileSchema, type ProfileDTO, type SellerProfileDTO } from '@karobarai/shared';
import { EmptyState, ImageUploader, StatusChip, toast } from '../../components';
import { CATEGORIES_QUERY_KEY, getCategories } from '../catalog/catalogApi';
import {
  PROFILE_QUERY_KEY,
  STORE_STATUS_QUERY_KEY,
  getStoreStatus,
  generateStoreDescription,
  removeStoreBanner,
  removeStoreLogo,
  updateSellerProfile,
  uploadStoreBanner,
  uploadStoreLogo,
  type StoreDescriptionSuggestion,
} from './profileApi';
import { formatProfileError } from './profileErrors';

interface FormValues {
  storeName: string;
  storeDescription: string;
  storeDescriptionUr: string;
  storeCategoryId: string | null;
  city: string;
  socialLinks: Record<SocialPlatform, string>;
}

const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'website'] as const;
type SocialPlatform = typeof SOCIAL_PLATFORMS[number];

function categoryOptions(categories: Awaited<ReturnType<typeof getCategories>>, isUr: boolean): Array<{ value: string; label: string }> {
  return categories.flatMap((category) => [
    { value: category.id, label: isUr ? category.nameUr : category.nameEn },
    ...categoryOptions(category.children, isUr),
  ]);
}

interface StoreBrandTabProps {
  profile: SellerProfileDTO;
}

// App Flow SCR-S10 "Store/Brand" tab — composes business info (this file's form), logo/banner
// (ImageUploader), and read-only status (StatusChip) per F3-store-management-backend.md Task 5.
// Each section saves independently — never a single "save everything" action (Task 5's explicit
// anti-pattern), so business-info edits never trigger a logo/banner call and vice versa.
export function StoreBrandTab({ profile }: StoreBrandTabProps) {
  const { t } = useTranslation(['profile', 'common']);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Defensive: RequireStore should make this unreachable with hasStore: false, but Task 5.3
  // calls for a graceful fallback rather than trusting the guard alone.
  if (!profile.hasStore) {
    return (
      <EmptyState
        title={t('profile:storeBrand.notOnboardedTitle')}
        description={t('profile:storeBrand.notOnboardedDescription')}
        actionLabel={t('profile:storeBrand.notOnboardedCta')}
        onAction={() => navigate('/seller/setup')}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      <BusinessInfoSection profile={profile} />

      <Card title={t('profile:storeBrand.logoLabel')}>
        <ImageUploader
          shape="circle"
          value={profile.logoUrl}
          uploadLabel={t('profile:storeBrand.uploadLogo')}
          removeLabel={t('profile:storeBrand.removeLogo')}
          onUpload={uploadStoreLogo}
          onRemove={removeStoreLogo}
          onSuccess={(result: ProfileDTO) => queryClient.setQueryData<ProfileDTO>(PROFILE_QUERY_KEY, result)}
          formatError={(err) => formatProfileError(t, err)}
        />
      </Card>

      <Card title={t('profile:storeBrand.bannerLabel')}>
        <ImageUploader
          shape="rect"
          value={profile.bannerUrl}
          uploadLabel={t('profile:storeBrand.uploadBanner')}
          removeLabel={t('profile:storeBrand.removeBanner')}
          onUpload={uploadStoreBanner}
          onRemove={removeStoreBanner}
          onSuccess={(result: ProfileDTO) => queryClient.setQueryData<ProfileDTO>(PROFILE_QUERY_KEY, result)}
          formatError={(err) => formatProfileError(t, err)}
        />
      </Card>

      <StoreStatusSection />
    </div>
  );
}

function BusinessInfoSection({ profile }: StoreBrandTabProps) {
  const { t } = useTranslation(['profile', 'common']);
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<StoreDescriptionSuggestion | null>(null);
  const [businessDetails, setBusinessDetails] = useState('');
  const { i18n } = useTranslation();
  const { data: categories = [] } = useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: getCategories });
  const links = Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => [platform, profile.socialLinks[platform] ?? ''])) as Record<SocialPlatform, string>;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { storeName: profile.storeName, storeDescription: profile.storeDescription ?? '', storeDescriptionUr: profile.storeDescriptionUr ?? '', storeCategoryId: profile.storeCategory?.id ?? null, city: profile.city ?? '', socialLinks: links },
  });

  useEffect(() => {
    reset({ storeName: profile.storeName, storeDescription: profile.storeDescription ?? '', storeDescriptionUr: profile.storeDescriptionUr ?? '', storeCategoryId: profile.storeCategory?.id ?? null, city: profile.city ?? '', socialLinks: Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => [platform, profile.socialLinks[platform] ?? ''])) as Record<SocialPlatform, string> });
  }, [profile, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const payload = {
      storeName: values.storeName,
      storeDescription: values.storeDescription.trim() === '' ? null : values.storeDescription,
      storeDescriptionUr: values.storeDescriptionUr.trim() === '' ? null : values.storeDescriptionUr,
      storeCategoryId: values.storeCategoryId,
      city: values.city,
      socialLinks: values.socialLinks,
    };

    const parsed = updateSellerProfileSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') as Parameters<typeof setError>[0];
        setError(field, { message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateSellerProfile(parsed.data);
      queryClient.setQueryData(PROFILE_QUERY_KEY, updated);
      toast.success(t('profile:storeBrand.savedConfirmation'));
    } catch (err) {
      setSubmitError(formatProfileError(t, err));
    } finally {
      setSubmitting(false);
    }
  });

  const onGenerate = async () => {
    if (generating) return;
    setGenerationError(null);
    setSuggestion(null);
    setGenerating(true);
    try {
      setSuggestion(await generateStoreDescription(businessDetails));
    } catch {
      setGenerationError(t('profile:storeBrand.generationError'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card title={t('profile:storeBrand.businessInfoTitle')}>
      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 'var(--sp-4)' }} />}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 'var(--sp-4)', maxWidth: 480 }}>
          <label htmlFor="store-brand-name">{t('profile:view.storeName')}</label>
          <Controller
            name="storeName"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="store-brand-name"
                size="large"
                aria-invalid={!!errors.storeName}
                aria-describedby={errors.storeName ? 'store-brand-name-error' : undefined}
              />
            )}
          />
          {errors.storeName && (
            <Typography.Text id="store-brand-name-error" type="danger">
              {errors.storeName.message}
            </Typography.Text>
          )}
        </div>

        <div style={{ marginBottom: 'var(--sp-4)', maxWidth: 480 }}>
          <label htmlFor="store-brand-category">{t('profile:storeBrand.category')}</label>
          <Controller name="storeCategoryId" control={control} render={({ field }) => (
            <Select id="store-brand-category" value={field.value ?? undefined} onChange={(value: string | undefined) => field.onChange(value ?? null)}
              options={categoryOptions(categories, i18n.language.startsWith('ur'))} allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} />
          )} />
          {errors.storeCategoryId && <Typography.Text type="danger">{errors.storeCategoryId.message}</Typography.Text>}
        </div>
        <div style={{ marginBottom: 'var(--sp-4)', maxWidth: 480 }}>
          <label htmlFor="store-brand-city">{t('profile:storeBrand.city')}</label>
          <Controller name="city" control={control} render={({ field }) => <Input {...field} id="store-brand-city" maxLength={80} />} />
          {errors.city && <Typography.Text type="danger">{errors.city.message}</Typography.Text>}
        </div>
        <Typography.Title level={5}>{t('profile:storeBrand.socialLinks')}</Typography.Title>
        {SOCIAL_PLATFORMS.map((platform) => (
          <div key={platform} style={{ marginBottom: 'var(--sp-3)', maxWidth: 480 }}>
            <label htmlFor={`store-brand-${platform}`}>{t(`profile:storeBrand.${platform}`)}</label>
            <Controller name={`socialLinks.${platform}`} control={control} render={({ field }) => (
              <Input {...field} id={`store-brand-${platform}`} maxLength={255} placeholder={platform === 'whatsapp' ? '+923001234567' : 'https://'} />
            )} />
            {errors.socialLinks?.[platform] && <Typography.Text type="danger">{errors.socialLinks[platform]?.message}</Typography.Text>}
          </div>
        ))}

        <div style={{ marginBottom: 'var(--sp-4)', maxWidth: 480 }}>
          <label htmlFor="store-brand-description">{t('profile:view.storeDescription')}</label>
          <Controller
            name="storeDescription"
            control={control}
            render={({ field }) => (
              <Input.TextArea
                {...field}
                id="store-brand-description"
                rows={4}
                maxLength={2000}
                dir="ltr"
                aria-invalid={!!errors.storeDescription}
                aria-describedby={errors.storeDescription ? 'store-brand-description-error' : undefined}
              />
            )}
          />
          {errors.storeDescription && (
            <Typography.Text id="store-brand-description-error" type="danger">
              {errors.storeDescription.message}
            </Typography.Text>
          )}
        </div>

        <div style={{ marginBottom: 'var(--sp-4)', maxWidth: 480 }}>
          <label htmlFor="store-brand-description-ur">{t('profile:storeBrand.descriptionUr')}</label>
          <Controller name="storeDescriptionUr" control={control} render={({ field }) => (
            <Input.TextArea {...field} id="store-brand-description-ur" rows={4} maxLength={2000} dir="rtl"
              aria-invalid={!!errors.storeDescriptionUr} aria-describedby={errors.storeDescriptionUr ? 'store-brand-description-ur-error' : undefined} />
          )} />
          {errors.storeDescriptionUr && <Typography.Text id="store-brand-description-ur-error" type="danger">{errors.storeDescriptionUr.message}</Typography.Text>}
        </div>

        <div style={{ marginBottom: 'var(--sp-4)', maxWidth: 480 }}>
          <label htmlFor="store-brand-ai-details">{t('profile:storeBrand.businessDetails')}</label>
          <Input.TextArea id="store-brand-ai-details" value={businessDetails} onChange={(event) => setBusinessDetails(event.target.value)}
            maxLength={500} rows={2} aria-describedby="store-brand-ai-details-hint" />
          <Typography.Text id="store-brand-ai-details-hint" type="secondary">{t('profile:storeBrand.businessDetailsHint')}</Typography.Text>
          <div style={{ marginTop: 'var(--sp-2)' }}>
            <Button type="default" htmlType="button" onClick={onGenerate} loading={generating} disabled={generating}>
              {t(profile.storeDescription || profile.storeDescriptionUr ? 'profile:storeBrand.regenerate' : 'profile:storeBrand.generate')}
            </Button>
          </div>
        </div>
        {generationError && <Alert type="error" showIcon message={generationError} style={{ marginBottom: 'var(--sp-4)' }} />}
        {suggestion && (
          <Alert type="success" showIcon style={{ marginBottom: 'var(--sp-4)' }}
            message={t('profile:storeBrand.suggestionReady')}
            description={<div>
              <p dir="ltr">{suggestion.descriptionEn}</p>
              <p dir="rtl">{suggestion.descriptionUr}</p>
              <Button type="default" htmlType="button" onClick={() => {
                setValue('storeDescription', suggestion.descriptionEn, { shouldDirty: true });
                setValue('storeDescriptionUr', suggestion.descriptionUr, { shouldDirty: true });
                setSuggestion(null);
              }}>{t('profile:storeBrand.applySuggestion')}</Button>
            </div>}
          />
        )}

        <Button type="primary" htmlType="submit" loading={submitting}>
          {t('profile:storeBrand.saveBusinessInfo')}
        </Button>
      </form>
    </Card>
  );
}

function StoreStatusSection() {
  const { t } = useTranslation(['profile']);
  const { data: status, isPending, isError } = useQuery({
    queryKey: STORE_STATUS_QUERY_KEY,
    queryFn: getStoreStatus,
  });

  return (
    <Card title={t('profile:storeBrand.statusTitle')}>
      {isPending && <Typography.Text type="secondary">…</Typography.Text>}
      {isError && <Typography.Text type="danger">{t('profile:errors.GENERIC')}</Typography.Text>}
      {status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <StatusChip status={status.status} />
          <Typography.Text type="secondary">
            {t('profile:storeBrand.statusSince', { date: new Date(status.since).toLocaleDateString() })}
          </Typography.Text>
        </div>
      )}
    </Card>
  );
}

