import { useEffect, useState } from 'react';
import { Alert, Button, Input, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { updateSellerProfileSchema } from '@karobarai/shared';
import { SkeletonLoader } from '../../components';
import { PROFILE_QUERY_KEY, getProfile, updateSellerProfile } from './profileApi';
import { formatProfileError } from './profileErrors';

interface FormValues {
  storeName: string;
  storeDescription: string;
  logoUrl: string;
}

// App Flow SCR-S10 "Store/Brand" tab — storeName/storeDescription/logoUrl only, per
// F2-profiles-backend.md ("no phone/email/name field exists here"). Seller-only: PATCH /me
// rejects any other role with 403 before this form's submit even matters, but the route itself
// is already gated to SELLER by ProtectedRoute.
export function EditProfilePage() {
  const { t } = useTranslation(['profile', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile, isPending } = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: getProfile });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { storeName: '', storeDescription: '', logoUrl: '' } });

  useEffect(() => {
    if (profile?.role === 'SELLER') {
      reset({
        storeName: profile.storeName,
        storeDescription: profile.storeDescription ?? '',
        logoUrl: profile.logoUrl ?? '',
      });
    }
  }, [profile, reset]);

  if (isPending) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader rows={4} />
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const payload = {
      storeName: values.storeName,
      storeDescription: values.storeDescription.trim() === '' ? null : values.storeDescription,
      logoUrl: values.logoUrl.trim() === '' ? null : values.logoUrl,
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
      navigate('/seller/profile');
    } catch (err) {
      setSubmitError(formatProfileError(t, err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('profile:edit.title')}</Typography.Title>

      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 16 }} />}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label>{t('profile:edit.storeNameLabel')}</label>
          <Controller
            name="storeName"
            control={control}
            render={({ field }) => <Input {...field} size="large" />}
          />
          {errors.storeName && <Typography.Text type="danger">{errors.storeName.message}</Typography.Text>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>{t('profile:edit.storeDescriptionLabel')}</label>
          <Controller
            name="storeDescription"
            control={control}
            render={({ field }) => <Input.TextArea {...field} rows={4} />}
          />
          {errors.storeDescription && (
            <Typography.Text type="danger">{errors.storeDescription.message}</Typography.Text>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>{t('profile:edit.logoUrlLabel')}</label>
          <Controller
            name="logoUrl"
            control={control}
            render={({ field }) => <Input {...field} size="large" placeholder="https://..." />}
          />
          {errors.logoUrl && <Typography.Text type="danger">{errors.logoUrl.message}</Typography.Text>}
        </div>

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          {t('profile:edit.submit')}
        </Button>
      </form>
    </div>
  );
}
