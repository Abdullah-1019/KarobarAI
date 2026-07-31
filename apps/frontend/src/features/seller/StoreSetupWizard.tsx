import { useState } from 'react';
import { Alert, Button, Input, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';

import { createStoreSchema } from '@karobarai/shared';
import { ApiError } from '../../api';
import { EmptyState, SkeletonLoader } from '../../components';
import { PROFILE_QUERY_KEY, createStore, getProfile } from '../profile/profileApi';
import { formatProfileError } from '../profile/profileErrors';

interface FormValues {
  storeName: string;
  storeDescription: string;
  jazzcashAccountNumber: string;
  easypaisaAccountNumber: string;
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
    defaultValues: { storeName: '', storeDescription: '', jazzcashAccountNumber: '', easypaisaAccountNumber: '' },
  });

  if (isPending) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
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
      jazzcashAccountNumber: values.jazzcashAccountNumber.trim() === '' ? undefined : values.jazzcashAccountNumber,
      easypaisaAccountNumber: values.easypaisaAccountNumber.trim() === '' ? undefined : values.easypaisaAccountNumber,
    };

    const parsed = createStoreSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
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
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert type="info" showIcon message={t('profile:storeSetup.alreadyComplete')} style={{ marginBottom: 16 }} />
        <Button type="primary" block onClick={() => navigate('/seller')}>
          {t('profile:storeSetup.continueToDashboard')}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('profile:storeSetup.title')}</Typography.Title>
      <Typography.Paragraph type="secondary">{t('profile:storeSetup.subtitle')}</Typography.Paragraph>

      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 16 }} />}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label>{t('profile:storeSetup.storeNameLabel')}</label>
          <Controller
            name="storeName"
            control={control}
            render={({ field }) => <Input {...field} size="large" />}
          />
          {errors.storeName && <Typography.Text type="danger">{errors.storeName.message}</Typography.Text>}
        </div>

        <div style={{ marginBottom: 24 }}>
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

        <Typography.Title level={5}>{t('profile:storeSetup.walletSectionTitle')}</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
          {t('profile:storeSetup.walletHelp')}
        </Typography.Paragraph>

        <div style={{ marginBottom: 16 }}>
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

        <div style={{ marginBottom: 24 }}>
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
