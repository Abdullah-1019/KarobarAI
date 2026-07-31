import { useEffect, useState } from 'react';
import { Alert, Button, Input, Typography } from 'antd';
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
    <div>
      <BusinessInfoSection profile={profile} />
      <div style={{ marginTop: 32 }}>
        <Typography.Title level={5}>{t('profile:storeBrand.logoLabel')}</Typography.Title>
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

      <div style={{ marginTop: 24 }}>
        <Typography.Title level={5}>{t('profile:storeBrand.bannerLabel')}</Typography.Title>
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
    <div>
      <Typography.Title level={5}>{t('profile:storeBrand.businessInfoTitle')}</Typography.Title>

      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 16 }} />}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 16, maxWidth: 480 }}>
          <label>{t('profile:view.storeName')}</label>
          <Controller
            name="storeName"
            control={control}
            render={({ field }) => <Input {...field} size="large" />}
          />
          {errors.storeName && <Typography.Text type="danger">{errors.storeName.message}</Typography.Text>}
        </div>

        <div style={{ marginBottom: 16, maxWidth: 480 }}>
          <label>{t('profile:view.storeDescription')}</label>
          <Controller
            name="storeDescription"
            control={control}
            render={({ field }) => <Input.TextArea {...field} rows={4} />}
          />
          {errors.storeDescription && (
            <Typography.Text type="danger">{errors.storeDescription.message}</Typography.Text>
          )}
        </div>

        <Button type="primary" htmlType="submit" loading={submitting}>
          {t('profile:storeBrand.saveBusinessInfo')}
        </Button>
      </form>
    </div>
  );
}

function StoreStatusSection() {
  const { t } = useTranslation(['profile']);
  const { data: status, isPending, isError } = useQuery({
    queryKey: STORE_STATUS_QUERY_KEY,
    queryFn: getStoreStatus,
  });

  return (
    <div style={{ marginTop: 32 }}>
      <Typography.Title level={5}>{t('profile:storeBrand.statusTitle')}</Typography.Title>
      {isPending && <Typography.Text type="secondary">…</Typography.Text>}
      {isError && <Typography.Text type="danger">{t('profile:errors.GENERIC')}</Typography.Text>}
      {status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusChip status={status.status} />
          <Typography.Text type="secondary">
            {t('profile:storeBrand.statusSince', { date: new Date(status.since).toLocaleDateString() })}
          </Typography.Text>
        </div>
      )}
    </div>
  );
}

