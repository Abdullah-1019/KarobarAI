import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, MailCheck, User } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { ForgotPasswordInput } from '@karobarai/shared';
import { forgotPasswordSchema } from '@karobarai/shared';
import { AuthLayout, AuthResult, FormAlert, PrimaryButton, TextField } from '../../components';
import { useLanguage } from '../../hooks';
import { forgotPassword } from './authApi';
import { formatAuthError } from './authErrors';

const RESEND_COOLDOWN_SECONDS = 60;

interface FormValues {
  identifier: string;
}

export function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const { dir } = useLanguage();
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentInput, setSentInput] = useState<ForgotPasswordInput | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { identifier: '' } });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const parsed = forgotPasswordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path[0] as keyof FormValues, { message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      await forgotPassword(parsed.data);
      setSentInput(parsed.data);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setSent(true);
    } catch (err) {
      setSubmitError(formatAuthError(t, err));
    } finally {
      setSubmitting(false);
    }
  });

  async function handleResend() {
    if (cooldown > 0 || resending || !sentInput) return;
    setSubmitError(null);
    setResending(true);
    try {
      await forgotPassword(sentInput);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setSubmitError(formatAuthError(t, err));
    } finally {
      setResending(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <AuthResult
          variant="success"
          icon={MailCheck}
          title={t('auth:forgotPassword.sent')}
          description={t('auth:forgotPassword.sentInstructions')}
        >
          <PrimaryButton onClick={() => navigate('/login')}>
            {t('auth:forgotPassword.returnToLogin')}
          </PrimaryButton>
          <div className="kaResendRow">
            {cooldown > 0 ? (
              <span>{t('auth:forgotPassword.resendIn', { seconds: cooldown })}</span>
            ) : (
              <button type="button" className="kaTextButton" onClick={handleResend} disabled={resending}>
                {t('auth:forgotPassword.resend')}
              </button>
            )}
          </div>
        </AuthResult>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth:forgotPassword.title')}
      subtitle={t('auth:forgotPassword.subtitle')}
      icon={KeyRound}
    >
      {submitError && <FormAlert variant="error">{submitError}</FormAlert>}

      <form onSubmit={onSubmit} noValidate>
        <Controller
          name="identifier"
          control={control}
          render={({ field }) => (
            <TextField
              id="forgot-identifier"
              name="identifier"
              label={t('auth:forgotPassword.identifierLabel')}
              icon={User}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.identifier?.message}
              placeholder={t('auth:forgotPassword.identifierPlaceholder')}
              autoComplete="username"
              autoFocus
            />
          )}
        />

        <PrimaryButton type="submit" loading={submitting}>
          {t('auth:forgotPassword.submit')}
        </PrimaryButton>
      </form>

      <div className="kaBackRow">
        <button type="button" className="kaTextButton" onClick={() => navigate('/login')}>
          <BackIcon size={16} aria-hidden="true" />
          {t('auth:forgotPassword.backToLogin')}
        </button>
      </div>
    </AuthLayout>
  );
}
