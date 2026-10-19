import { useState } from 'react';
import { Alert, Button, Input, Select, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';

import { createStoreSchema, type CategoryDTO } from '@karobarai/shared';
import { ApiError } from '../../api';
import { EmptyState, SkeletonLoader } from '../../components';
import { PROFILE_QUERY_KEY, createStore, getProfile } from '../profile/profileApi';
import { CATEGORIES_QUERY_KEY, getCategories } from '../catalog/catalogApi';
import { formatProfileError } from '../profile/profileErrors';

interface FormValues {
  storeName: string;
  storeDescription: string;
  jazzcashAccountNumber: string;
  easypaisaAccountNumber: string;
  storeCategoryId: string | null;
  city: string;
  socialLinks: Record<SocialPlatform, string>;
}

const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'website'] as const;
type SocialPlatform = typeof SOCIAL_PLATFORMS[number];

function flattenCategories(categories: CategoryDTO[]): CategoryDTO[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

// App Flow SCR-S00 — the Store-Setup Wizard's persistence layer. Single-page form rather than a
// multi-step stepper: the backend only ever sees one final POST (no draft persistence exists,
// F3-store-management-backend.md Task 2.4), so step-state machinery would add complexity with no
// backend-visible benefit. Redirects home if onboarding is already complete, defensively avoiding
// a stray 409 from a returning Seller landing here again.
export function StoreSetupWizard() {
  const { t } = useTranslation(['profile', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const { data: categories = [] } = useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: getCategories });
  const categoryOptions = flattenCategories(categories).map((category) => ({
    value: category.id,
    label: i18n.language.startsWith('ur') ? category.nameUr : category.nameEn,
  }));

  const { data: profile, isPending, isError, error, refetch } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: getProfile,
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alreadyComplete, setAlreadyComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { storeName: '', storeDescription: '', jazzcashAccountNumber: '', easypaisaAccountNumber: '', storeCategoryId: null, city: '', socialLinks: Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => [platform, ''])) as Record<SocialPlatform, string> },
  });

  if (isPending) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <SkeletonLoader rows={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title={t('common:state.error')}
        description={formatProfileError(t, error)}
        actionLabel={t('common:actions.retry')}
        onAction={() => refetch()}
      />
    );
  }

  if (profile.role === 'SELLER' && profile.hasStore) {
    return <Navigate to="/seller" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const payload = {
      storeName: values.storeName,
      storeDescription: values.storeDescription.trim() === '' ? null : values.storeDescription,
      storeCategoryId: values.storeCategoryId,
      city: values.city,
      socialLinks: values.socialLinks,
      jazzcashAccountNumber: values.jazzcashAccountNumber.trim() === '' ? undefined : values.jazzcashAccountNumber,
      easypaisaAccountNumber: values.easypaisaAccountNumber.trim() === '' ? undefined : values.easypaisaAccountNumber,
    };

    const parsed = createStoreSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') as Parameters<typeof setError>[0];
        setError(field, { message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      const updated = await createStore(parsed.data);
      queryClient.setQueryData(PROFILE_QUERY_KEY, updated);
      navigate('/seller');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ONBOARDING_ALREADY_COMPLETE') {
        setAlreadyComplete(true);
      } else {
        setSubmitError(formatProfileError(t, err));
      }
    } finally {
      setSubmitting(false);
    }
  });

  if (alreadyComplete) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <Alert type="info" showIcon message={t('profile:storeSetup.alreadyComplete')} style={{ marginBottom: 'var(--sp-4)' }} />
        <Button type="primary" block onClick={() => navigate('/seller')}>
          {t('profile:storeSetup.continueToDashboard')}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <Typography.Title level={3} style={{ marginBottom: 'var(--sp-1)' }}>{t('profile:storeSetup.title')}</Typography.Title>
      <Typography.Paragraph type="secondary">{t('profile:storeSetup.subtitle')}</Typography.Paragraph>

      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 'var(--sp-4)' }} />}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label>{t('profile:storeSetup.storeNameLabel')}</label>
          <Controller
            name="storeName"
            control={control}
            render={({ field }) => <Input {...field} size="large" />}
          />
          {errors.storeName && <Typography.Text type="danger">{errors.storeName.message}</Typography.Text>}
        </div>

        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <label>{t('profile:storeSetup.storeDescriptionLabel')}</label>
          <Controller
            name="storeDescription"
            control={control}
            render={({ field }) => <Input.TextArea {...field} rows={4} />}
          />
          {errors.storeDescription && (
            <Typography.Text type="danger">{errors.storeDescription.message}</Typography.Text>
          )}
        </div>

        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label htmlFor="store-setup-category">{t('profile:storeBrand.category')}</label>
          <Controller name="storeCategoryId" control={control} render={({ field }) => (
            <Select id="store-setup-category" value={field.value ?? undefined} onChange={(value: string | undefined) => field.onChange(value ?? null)}
              options={categoryOptions} allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} />
          )} />
          {errors.storeCategoryId && <Typography.Text type="danger">{errors.storeCategoryId.message}</Typography.Text>}
        </div>
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label htmlFor="store-setup-city">{t('profile:storeBrand.city')}</label>
          <Controller name="city" control={control} render={({ field }) => <Input {...field} id="store-setup-city" maxLength={80} />} />
          {errors.city && <Typography.Text type="danger">{errors.city.message}</Typography.Text>}
        </div>
        <Typography.Title level={5}>{t('profile:storeBrand.socialLinks')}</Typography.Title>
        {SOCIAL_PLATFORMS.map((platform) => (
          <div key={platform} style={{ marginBottom: 'var(--sp-3)' }}>
            <label htmlFor={`store-setup-${platform}`}>{t(`profile:storeBrand.${platform}`)}</label>
            <Controller name={`socialLinks.${platform}`} control={control} render={({ field }) => (
              <Input {...field} id={`store-setup-${platform}`} maxLength={255} placeholder={platform === 'whatsapp' ? '+923001234567' : 'https://'} />
            )} />
            {errors.socialLinks?.[platform] && <Typography.Text type="danger">{errors.socialLinks[platform]?.message}</Typography.Text>}
          </div>
        ))}

        <Typography.Title level={5}>{t('profile:storeSetup.walletSectionTitle')}</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 'calc(-1 * var(--sp-2))' }}>
          {t('profile:storeSetup.walletHelp')}
        </Typography.Paragraph>

        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label>{t('profile:storeSetup.jazzcashLabel')}</label>
          <Controller
            name="jazzcashAccountNumber"
            control={control}
            render={({ field }) => <Input {...field} size="large" />}
          />
          {errors.jazzcashAccountNumber && (
            <Typography.Text type="danger">{errors.jazzcashAccountNumber.message}</Typography.Text>
          )}
        </div>

        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <label>{t('profile:storeSetup.easypaisaLabel')}</label>
          <Controller
            name="easypaisaAccountNumber"
            control={control}
            render={({ field }) => <Input {...field} size="large" />}
          />
          {errors.easypaisaAccountNumber && (
            <Typography.Text type="danger">{errors.easypaisaAccountNumber.message}</Typography.Text>
          )}
        </div>

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          {t('profile:storeSetup.submit')}
        </Button>
      </form>
    </div>
  );
}
