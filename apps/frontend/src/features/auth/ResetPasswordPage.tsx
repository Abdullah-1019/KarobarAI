import { useState } from 'react';
import { Alert, Button, Input, Typography } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { resetPasswordSchema } from '@karobarai/shared';
import { PasswordStrengthMeter } from '../../components';
import { ApiError } from '../../api';
import { AuthLayout } from './AuthLayout';
import { resetPassword } from './authApi';
import { formatAuthError } from './authErrors';

interface FormValues {
  newPassword: string;
  confirmPassword: string;
}

// SCR-A04 (second half), route `/reset-password?token=`. On success, a reset revokes every
// session for the account, not just this browser (HO-F1-Auth.md) — the success state must say so
// explicitly, otherwise a user with another tab/device open sees a surprise logout.
export function ResetPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { newPassword: '', confirmPassword: '' } });

  const newPassword = watch('newPassword');

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    setTokenInvalid(false);

    const parsed = resetPasswordSchema.safeParse({ token, ...values });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
        if (field === 'newPassword' || field === 'confirmPassword') {
          setError(field, { message: issue.message });
        }
      }
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(parsed.data);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RESET_TOKEN_INVALID') {
        setTokenInvalid(true);
      } else {
        setSubmitError(formatAuthError(t, err));
      }
    } finally {
      setSubmitting(false);
    }
  });

  if (done) {
    return (
      <AuthLayout title={t('auth:resetPassword.successTitle')}>
        <Alert
          type="success"
          showIcon
          description={t('auth:resetPassword.successSignedOutEverywhere')}
          style={{ marginBottom: 'var(--sp-4)' }}
        />
        <Link to="/login">{t('auth:login.title')}</Link>
      </AuthLayout>
    );
  }

  if (tokenInvalid) {
    return (
      <AuthLayout title={t('auth:resetPassword.title')}>
        <Alert type="error" showIcon message={t('auth:resetPassword.tokenInvalid')} style={{ marginBottom: 'var(--sp-4)' }} />
        <Link to="/forgot-password">{t('auth:resetPassword.requestNewLink')}</Link>
      </AuthLayout>
    );
  }

  if (!token) {
    return (
      <AuthLayout title={t('auth:resetPassword.title')}>
        <Alert type="warning" showIcon message={t('auth:resetPassword.missingToken')} style={{ marginBottom: 'var(--sp-4)' }} />
        <Link to="/forgot-password">{t('auth:resetPassword.requestNewLink')}</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth:resetPassword.title')}>
      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 'var(--sp-4)' }} />}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label htmlFor="reset-new-password">{t('auth:resetPassword.newPasswordLabel')}</label>
          <Controller
            name="newPassword"
            control={control}
            render={({ field }) => (
              <Input.Password
                {...field}
                id="reset-new-password"
                size="large"
                aria-invalid={!!errors.newPassword}
                aria-describedby={errors.newPassword ? 'reset-new-password-error' : undefined}
              />
            )}
          />
          <PasswordStrengthMeter password={newPassword ?? ''} />
          {errors.newPassword && (
            <Typography.Text id="reset-new-password-error" type="danger">
              {errors.newPassword.message}
            </Typography.Text>
          )}
        </div>

        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label htmlFor="reset-confirm-password">{t('auth:resetPassword.confirmPasswordLabel')}</label>
          <Controller
            name="confirmPassword"
            control={control}
            render={({ field }) => (
              <Input.Password
                {...field}
                id="reset-confirm-password"
                size="large"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'reset-confirm-password-error' : undefined}
              />
            )}
          />
          {errors.confirmPassword && (
            <Typography.Text id="reset-confirm-password-error" type="danger">
              {errors.confirmPassword.message}
            </Typography.Text>
          )}
        </div>

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          {t('auth:resetPassword.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
