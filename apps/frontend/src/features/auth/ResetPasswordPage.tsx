import { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, LockKeyhole, X } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { resetPasswordSchema } from '@karobarai/shared';
import { ApiError } from '../../api';
import { AuthLayout, AuthResult, FormAlert, PasswordField, PrimaryButton } from '../../components';
import { resetPassword } from './authApi';
import { formatAuthError } from './authErrors';

interface FormValues {
  newPassword: string;
  confirmPassword: string;
}

export function ResetPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
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
  const confirmPassword = watch('confirmPassword');
  const showMatch = newPassword.length > 0 && confirmPassword.length > 0;
  const matched = newPassword === confirmPassword;

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
      <AuthLayout>
        <AuthResult
          variant="success"
          icon={CheckCircle2}
          title={t('auth:resetPassword.successTitle')}
          description={t('auth:resetPassword.successSignedOutEverywhere')}
        >
          <PrimaryButton onClick={() => navigate('/login')}>{t('auth:resetPassword.backToLogin')}</PrimaryButton>
        </AuthResult>
      </AuthLayout>
    );
  }

  if (tokenInvalid || !token) {
    const isMissing = !token;
    return (
      <AuthLayout>
        <AuthResult
          variant="error"
          icon={AlertCircle}
          title={t('auth:resetPassword.title')}
          description={isMissing ? t('auth:resetPassword.missingToken') : t('auth:resetPassword.tokenInvalid')}
        >
          <PrimaryButton onClick={() => navigate('/forgot-password')}>
            {t('auth:resetPassword.requestNewLink')}
          </PrimaryButton>
        </AuthResult>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth:resetPassword.title')}
      subtitle={t('auth:resetPassword.subtitle')}
      icon={LockKeyhole}
    >
      {submitError && <FormAlert variant="error">{submitError}</FormAlert>}

      <form onSubmit={onSubmit} noValidate>
        <Controller
          name="newPassword"
          control={control}
          render={({ field }) => (
            <PasswordField
              id="reset-new-password"
              name="newPassword"
              label={t('auth:resetPassword.newPasswordLabel')}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.newPassword?.message}
              autoComplete="new-password"
              showStrength
              showChecklist
              autoFocus
            />
          )}
        />

        <Controller
          name="confirmPassword"
          control={control}
          render={({ field }) => (
            <PasswordField
              id="reset-confirm-password"
              name="confirmPassword"
              label={t('auth:resetPassword.confirmPasswordLabel')}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.confirmPassword?.message}
              autoComplete="new-password"
            />
          )}
        />

        {showMatch && !errors.confirmPassword && (
          <p className={matched ? 'kaMatch kaMatch--ok' : 'kaMatch kaMatch--bad'}>
            {matched ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
            {matched ? t('auth:resetPassword.passwordsMatch') : t('auth:resetPassword.passwordsMismatch')}
          </p>
        )}

        <PrimaryButton type="submit" loading={submitting}>
          {t('auth:resetPassword.submit')}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
