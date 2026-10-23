import { useEffect, useState } from 'react';
import { Alert, Button, Input, Select } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, ImageIcon, MessageCircle, Store } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { updateSellerProfileSchema, type ProfileDTO, type SellerProfileDTO } from '@karobarai/shared';
import { EmptyState, ImageUploader, StatusChip, toast } from '../../components';
import { AiMark } from '../../components/AiMark';
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
// Styles: settings.css (st*), plus the sticky glass save bar from seller.css.
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
    <div className="stStack">
      <BusinessInfoSection profile={profile} />

      <section className="stCard">
        <header className="stCardHead">
          <span className="stCardIcon" aria-hidden="true"><ImageIcon size={18} /></span>
          <div>
            <h2 className="stCardTitle">{t('profile:storeBrandUi.mediaTitle')}</h2>
            <p className="stCardHint">{t('profile:storeBrandUi.mediaHint')}</p>
          </div>
        </header>
        <div className="stMedia">
          <div className="stMediaItem">
            <span className="stLabel">{t('profile:storeBrand.logoLabel')}</span>
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
          </div>
          <div className="stMediaItem stMediaItem--wide">
            <span className="stLabel">{t('profile:storeBrand.bannerLabel')}</span>
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
          </div>
        </div>
      </section>

      <StoreStatusSection />
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return <span id={id} className="stError" role="alert">{message}</span>;
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
    <form onSubmit={onSubmit} className="stStack">
      <section className="stCard">
        <header className="stCardHead">
          <span className="stCardIcon" aria-hidden="true"><Store size={18} /></span>
          <div>
            <h2 className="stCardTitle">{t('profile:storeBrand.businessInfoTitle')}</h2>
            <p className="stCardHint">{t('profile:storeBrandUi.businessHint')}</p>
          </div>
        </header>

        {submitError && <Alert type="error" message={submitError} showIcon />}

        <div className="stGrid">
          <div className="stField">
            <label className="stLabel" htmlFor="store-brand-name">{t('profile:view.storeName')}</label>
            <Controller
              name="storeName"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="store-brand-name"
                  status={errors.storeName ? 'error' : undefined}
                  aria-invalid={!!errors.storeName}
                  aria-describedby={errors.storeName ? 'store-brand-name-error' : undefined}
                />
              )}
            />
            <FieldError id="store-brand-name-error" message={errors.storeName?.message} />
          </div>

          <div className="stField">
            <label className="stLabel" htmlFor="store-brand-category">{t('profile:storeBrand.category')}</label>
            <Controller name="storeCategoryId" control={control} render={({ field }) => (
              <Select id="store-brand-category" value={field.value ?? undefined} onChange={(value: string | undefined) => field.onChange(value ?? null)}
                options={categoryOptions(categories, i18n.language.startsWith('ur'))} allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} />
            )} />
            <FieldError message={errors.storeCategoryId?.message} />
          </div>

          <div className="stField">
            <label className="stLabel" htmlFor="store-brand-city">{t('profile:storeBrand.city')}</label>
            <Controller name="city" control={control} render={({ field }) => <Input {...field} id="store-brand-city" maxLength={80} status={errors.city ? 'error' : undefined} />} />
            <FieldError message={errors.city?.message} />
          </div>
        </div>
      </section>

      <section className="stCard">
        <header className="stCardHead">
          <div>
            <h2 className="stCardTitle">{t('profile:storeBrandUi.descriptionTitle')}</h2>
            <p className="stCardHint">{t('profile:storeBrandUi.descriptionHint')}</p>
          </div>
        </header>

        <div className="stGrid">
          <div className="stField">
            <label className="stLabel" htmlFor="store-brand-description">{t('profile:view.storeDescription')}</label>
            <Controller
              name="storeDescription"
              control={control}
              render={({ field }) => (
                <Input.TextArea
                  {...field}
                  id="store-brand-description"
                  rows={5}
                  maxLength={2000}
                  showCount
                  dir="ltr"
                  aria-invalid={!!errors.storeDescription}
                  aria-describedby={errors.storeDescription ? 'store-brand-description-error' : undefined}
                />
              )}
            />
            <FieldError id="store-brand-description-error" message={errors.storeDescription?.message} />
          </div>

          <div className="stField">
            <label className="stLabel" htmlFor="store-brand-description-ur">{t('profile:storeBrand.descriptionUr')}</label>
            <Controller name="storeDescriptionUr" control={control} render={({ field }) => (
              <Input.TextArea {...field} id="store-brand-description-ur" rows={5} maxLength={2000} showCount dir="rtl" className="stUrdu"
                aria-invalid={!!errors.storeDescriptionUr} aria-describedby={errors.storeDescriptionUr ? 'store-brand-description-ur-error' : undefined} />
            )} />
            <FieldError id="store-brand-description-ur-error" message={errors.storeDescriptionUr?.message} />
          </div>
        </div>

        <div className="stAi">
          <div className="stAiHead">
            <span className="stAiMark" aria-hidden="true"><AiMark size={16} color="var(--ai-accent)" /></span>
            <div>
              <p className="stAiTitle">{t('profile:storeBrandUi.aiTitle')}</p>
              <p className="stCardHint" id="store-brand-ai-details-hint">{t('profile:storeBrand.businessDetailsHint')}</p>
            </div>
          </div>
          <label className="stLabel" htmlFor="store-brand-ai-details">{t('profile:storeBrand.businessDetails')}</label>
          <Input.TextArea id="store-brand-ai-details" value={businessDetails} onChange={(event) => setBusinessDetails(event.target.value)}
            maxLength={500} rows={2} aria-describedby="store-brand-ai-details-hint" />
          <div>
            <Button htmlType="button" onClick={onGenerate} loading={generating} disabled={generating}
              icon={<AiMark size={14} color="currentColor" />}>
              {t(profile.storeDescription || profile.storeDescriptionUr ? 'profile:storeBrand.regenerate' : 'profile:storeBrand.generate')}
            </Button>
          </div>
          {generationError && <Alert type="error" showIcon message={generationError} />}
          {suggestion && (
            <div className="stSuggestion">
              <p className="stSuggestionTitle">{t('profile:storeBrand.suggestionReady')}</p>
              <div className="stSuggestionPair">
                <p dir="ltr">{suggestion.descriptionEn}</p>
                <p dir="rtl" className="stUrdu">{suggestion.descriptionUr}</p>
              </div>
              <Button type="default" htmlType="button" onClick={() => {
                setValue('storeDescription', suggestion.descriptionEn, { shouldDirty: true });
                setValue('storeDescriptionUr', suggestion.descriptionUr, { shouldDirty: true });
                setSuggestion(null);
              }}>{t('profile:storeBrand.applySuggestion')}</Button>
            </div>
          )}
        </div>
      </section>

      <section className="stCard">
        <header className="stCardHead">
          <span className="stCardIcon" aria-hidden="true"><Globe size={18} /></span>
          <div>
            <h2 className="stCardTitle">{t('profile:storeBrand.socialLinks')}</h2>
            <p className="stCardHint">{t('profile:storeBrandUi.socialHint')}</p>
          </div>
        </header>
        <div className="stGrid">
          {SOCIAL_PLATFORMS.map((platform) => (
            <div key={platform} className="stField">
              <label className="stLabel" htmlFor={`store-brand-${platform}`}>{t(`profile:storeBrand.${platform}`)}</label>
              <Controller name={`socialLinks.${platform}`} control={control} render={({ field }) => (
                <Input {...field} id={`store-brand-${platform}`} maxLength={255} dir="ltr"
                  prefix={platform === 'whatsapp' ? <MessageCircle size={15} aria-hidden="true" /> : <Globe size={15} aria-hidden="true" />}
                  placeholder={platform === 'whatsapp' ? '+923001234567' : 'https://'}
                  status={errors.socialLinks?.[platform] ? 'error' : undefined} />
              )} />
              <FieldError message={errors.socialLinks?.[platform]?.message} />
            </div>
          ))}
        </div>
      </section>

      <div className="slActionBar stActionBar">
        <span className="stActionHint">{t('profile:storeBrandUi.saveHint')}</span>
        <Button type="primary" htmlType="submit" loading={submitting}>
          {t('profile:storeBrand.saveBusinessInfo')}
        </Button>
      </div>
    </form>
  );
}

function StoreStatusSection() {
  const { t } = useTranslation(['profile']);
  const { data: status, isPending, isError } = useQuery({
    queryKey: STORE_STATUS_QUERY_KEY,
    queryFn: getStoreStatus,
  });

  return (
    <section className="stCard stStatus">
      <div>
        <h2 className="stCardTitle">{t('profile:storeBrand.statusTitle')}</h2>
        <p className="stCardHint">{t('profile:storeBrandUi.statusHint')}</p>
      </div>
      <div className="stStatusValue">
        {isPending && <span className="stShimmer" aria-hidden="true" />}
        {isError && <span className="stError">{t('profile:errors.GENERIC')}</span>}
        {status && (
          <>
            <StatusChip status={status.status} />
            <span className="stCardHint">{t('profile:storeBrand.statusSince', { date: new Date(status.since).toLocaleDateString() })}</span>
          </>
        )}
      </div>
    </section>
  );
}
