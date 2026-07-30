import { useState } from 'react';
import { Alert, Button, Input, Typography } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { resetPasswordSchema } from '@karobarai/shared';
import { PasswordStrengthMeter } from '../../components';
import { ApiError } from '../../api';
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
      <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert
          type="success"
          showIcon
          message={t('auth:resetPassword.successTitle')}
          description={t('auth:resetPassword.successSignedOutEverywhere')}
          style={{ marginBottom: 16 }}
        />
        <Link to="/login">{t('auth:login.title')}</Link>
      </div>
    );
  }

  if (tokenInvalid) {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert type="error" showIcon message={t('auth:resetPassword.tokenInvalid')} style={{ marginBottom: 16 }} />
        <Link to="/forgot-password">{t('auth:resetPassword.requestNewLink')}</Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert type="warning" showIcon message={t('auth:resetPassword.missingToken')} style={{ marginBottom: 16 }} />
        <Link to="/forgot-password">{t('auth:resetPassword.requestNewLink')}</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('auth:resetPassword.title')}</Typography.Title>

      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 16 }} />}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label>{t('auth:resetPassword.newPasswordLabel')}</label>
          <Controller
            name="newPassword"
            control={control}
            render={({ field }) => <Input.Password {...field} size="large" />}
          />
          <PasswordStrengthMeter password={newPassword ?? ''} />
          {errors.newPassword && <Typography.Text type="danger">{errors.newPassword.message}</Typography.Text>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>{t('auth:resetPassword.confirmPasswordLabel')}</label>
          <Controller
            name="confirmPassword"
            control={control}
            render={({ field }) => <Input.Password {...field} size="large" />}
          />
          {errors.confirmPassword && (
            <Typography.Text type="danger">{errors.confirmPassword.message}</Typography.Text>
          )}
        </div>

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          {t('auth:resetPassword.submit')}
        </Button>
      </form>
    </div>
  );
}
