import { useState } from 'react';
import { Alert, Button, Input, Typography } from 'antd';
import { ArrowLeft, ArrowRight, KeyRound } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { forgotPasswordSchema } from '@karobarai/shared';
import { useLanguage } from '../../hooks';
import { AuthLayout } from './AuthLayout';
import { forgotPassword } from './authApi';
import { formatAuthError } from './authErrors';

interface FormValues {
  identifier: string;
}

// SCR-A04 (first half) — always succeeds regardless of whether the identifier matches an
// account (no enumeration, per HO-F1-Auth.md), so there's no "account not found" error state to
// build here — only a generic network-failure path.
export function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const { dir } = useLanguage();
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { identifier: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const parsed = forgotPasswordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
        setError(field, { message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      await forgotPassword(parsed.data);
      setSent(true);
    } catch (err) {
      setSubmitError(formatAuthError(t, err));
    } finally {
      setSubmitting(false);
    }
  });

  if (sent) {
    return (
      <AuthLayout title={t('auth:forgotPassword.title')} icon={KeyRound}>
        <Alert type="success" showIcon message={t('auth:forgotPassword.sent')} style={{ marginBottom: 'var(--sp-4)' }} />
        <Link to="/login">{t('auth:login.title')}</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth:forgotPassword.title')} subtitle={t('auth:forgotPassword.subtitle')} icon={KeyRound}>
      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 'var(--sp-4)' }} />}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label htmlFor="forgot-identifier">{t('auth:forgotPassword.identifierLabel')}</label>
          <Controller
            name="identifier"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="forgot-identifier"
                size="large"
                aria-invalid={!!errors.identifier}
                aria-describedby={errors.identifier ? 'forgot-identifier-error' : undefined}
              />
            )}
          />
          {errors.identifier && (
            <Typography.Text id="forgot-identifier-error" type="danger">
              {errors.identifier.message}
            </Typography.Text>
          )}
        </div>

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          {t('auth:forgotPassword.submit')}
        </Button>
      </form>

      <Button
        className="karobarai-auth-btn-ghost"
        size="large"
        block
        icon={<BackIcon size={16} aria-hidden="true" />}
        onClick={() => navigate('/login')}
        style={{ marginTop: 'var(--sp-3)' }}
      >
        {t('auth:forgotPassword.backToLogin')}
      </Button>
    </AuthLayout>
  );
}
