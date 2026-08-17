import { useState } from 'react';
import { Alert, Button, Card, Input, Typography } from 'antd';
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
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
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
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <Typography.Title level={3} style={{ marginBottom: 'var(--sp-5)' }}>
        {t('profile:changePassword.title')}
      </Typography.Title>

      <Card>
        {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 'var(--sp-4)' }} />}

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <label htmlFor="change-password-current">{t('profile:changePassword.currentPasswordLabel')}</label>
            <Controller
              name="currentPassword"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  id="change-password-current"
                  size="large"
                  aria-invalid={!!errors.currentPassword}
                  aria-describedby={errors.currentPassword ? 'change-password-current-error' : undefined}
                />
              )}
            />
            {errors.currentPassword && (
              <Typography.Text id="change-password-current-error" type="danger">
                {errors.currentPassword.message}
              </Typography.Text>
            )}
          </div>

          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <label htmlFor="change-password-new">{t('profile:changePassword.newPasswordLabel')}</label>
            <Controller
              name="newPassword"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  id="change-password-new"
                  size="large"
                  aria-invalid={!!errors.newPassword}
                  aria-describedby={errors.newPassword ? 'change-password-new-error' : undefined}
                />
              )}
            />
            <PasswordStrengthMeter password={newPassword ?? ''} />
            {errors.newPassword && (
              <Typography.Text id="change-password-new-error" type="danger">
                {errors.newPassword.message}
              </Typography.Text>
            )}
          </div>

          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <label htmlFor="change-password-confirm">{t('profile:changePassword.confirmNewPasswordLabel')}</label>
            <Controller
              name="confirmNewPassword"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  id="change-password-confirm"
                  size="large"
                  aria-invalid={!!errors.confirmNewPassword}
                  aria-describedby={errors.confirmNewPassword ? 'change-password-confirm-error' : undefined}
                />
              )}
            />
            {errors.confirmNewPassword && (
              <Typography.Text id="change-password-confirm-error" type="danger">
                {errors.confirmNewPassword.message}
              </Typography.Text>
            )}
          </div>

          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            {t('profile:changePassword.submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
