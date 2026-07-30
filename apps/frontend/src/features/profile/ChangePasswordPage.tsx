import { useState } from 'react';
import { Alert, Button, Input, Typography } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { changePasswordSchema } from '@karobarai/shared';
import { PasswordStrengthMeter } from '../../components';
import { ApiError } from '../../api';
import { useAuthStore } from '../../lib/authStore';
import { changePassword } from './profileApi';
import { formatProfileError } from './profileErrors';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// F2-profiles-backend.md: on success every *other* session/device is revoked, but this device
// gets a fresh token pair and stays logged in — must show the "signed out elsewhere" messaging
// (same requirement as auth's reset-password) without actually logging this session out.
export function ChangePasswordPage() {
  const { t } = useTranslation(['profile', 'common']);
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const newPassword = watch('newPassword');

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
        setError(field, { message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      const { accessToken } = await changePassword(parsed.data);
      // user identity doesn't change here — reuse what's already in the store, just rotate the token.
      if (user) setSession(accessToken, user);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CURRENT_PASSWORD') {
        setError('currentPassword', { message: t('profile:changePassword.invalidCurrentPassword') });
      } else {
        setSubmitError(formatProfileError(t, err));
      }
    } finally {
      setSubmitting(false);
    }
  });

  if (done) {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert
          type="success"
          showIcon
          message={t('profile:changePassword.successTitle')}
          description={t('profile:changePassword.successSignedOutEverywhere')}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('profile:changePassword.title')}</Typography.Title>

      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 16 }} />}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label>{t('profile:changePassword.currentPasswordLabel')}</label>
          <Controller
            name="currentPassword"
            control={control}
            render={({ field }) => <Input.Password {...field} size="large" />}
          />
          {errors.currentPassword && (
            <Typography.Text type="danger">{errors.currentPassword.message}</Typography.Text>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>{t('profile:changePassword.newPasswordLabel')}</label>
          <Controller
            name="newPassword"
            control={control}
            render={({ field }) => <Input.Password {...field} size="large" />}
          />
          <PasswordStrengthMeter password={newPassword ?? ''} />
          {errors.newPassword && <Typography.Text type="danger">{errors.newPassword.message}</Typography.Text>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>{t('profile:changePassword.confirmNewPasswordLabel')}</label>
          <Controller
            name="confirmNewPassword"
            control={control}
            render={({ field }) => <Input.Password {...field} size="large" />}
          />
          {errors.confirmNewPassword && (
            <Typography.Text type="danger">{errors.confirmNewPassword.message}</Typography.Text>
          )}
        </div>

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          {t('profile:changePassword.submit')}
        </Button>
      </form>
    </div>
  );
}
