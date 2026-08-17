import { useEffect, useState } from 'react';
import { Alert, Button, Card, Input, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { updateSellerProfileSchema, type ProfileDTO, type SellerProfileDTO } from '@karobarai/shared';
import { EmptyState, ImageUploader, StatusChip, toast } from '../../components';
import {
  PROFILE_QUERY_KEY,
  STORE_STATUS_QUERY_KEY,
  getStoreStatus,
  removeStoreBanner,
  removeStoreLogo,
  updateSellerProfile,
  uploadStoreBanner,
  uploadStoreLogo,
} from './profileApi';
import { formatProfileError } from './profileErrors';

interface FormValues {
  storeName: string;
  storeDescription: string;
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

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { storeName: profile.storeName, storeDescription: profile.storeDescription ?? '' },
  });

  useEffect(() => {
    reset({ storeName: profile.storeName, storeDescription: profile.storeDescription ?? '' });
  }, [profile.storeName, profile.storeDescription, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const payload = {
      storeName: values.storeName,
      storeDescription: values.storeDescription.trim() === '' ? null : values.storeDescription,
    };

    const parsed = updateSellerProfileSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
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
          <label htmlFor="store-brand-description">{t('profile:view.storeDescription')}</label>
          <Controller
            name="storeDescription"
            control={control}
            render={({ field }) => (
              <Input.TextArea
                {...field}
                id="store-brand-description"
                rows={4}
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

