import { useState } from 'react';
import { LogIn, User } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { loginSchema } from '@karobarai/shared';
import { AuthLayout, FormAlert, PasswordField, PrimaryButton, TextField } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { useLanguageStore } from '../../lib/languageStore';
import { login } from './authApi';
import { formatAuthError } from './authErrors';
import { roleHomePath } from './roleHome';

interface FormValues {
  identifier: string;
  password: string;
}

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);

  // Arriving from a successful OTP check: confirm it here (OTP hands over to /login, no auto-login).
  const justVerified = (location.state as { verified?: boolean } | null)?.verified === true;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { identifier: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
        setError(field, { message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      const session = await login(parsed.data);
      setSession(session.accessToken, session.user);
      useLanguageStore.getState().setLanguage(session.user.preferredLanguage);

      const redirect = (location.state as { redirect?: string } | null)?.redirect;
      navigate(redirect ?? roleHomePath(session.user.role));
    } catch (err) {
      setSubmitError(formatAuthError(t, err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthLayout
      title={t('auth:login.title')}
      subtitle={t('auth:login.subtitle')}
      icon={LogIn}
      footer={
        <>
          {t('auth:login.noAccount')}{' '}
          <Link to="/register">{t('auth:login.registerLink')}</Link>
        </>
      }
    >
      {submitError ? (
        <FormAlert variant="error">{submitError}</FormAlert>
      ) : justVerified ? (
        <FormAlert variant="success">{t('auth:login.verifiedNotice')}</FormAlert>
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        <Controller
          name="identifier"
          control={control}
          render={({ field }) => (
            <TextField
              id="login-identifier"
              label={t('auth:login.identifierLabel')}
              icon={User}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('auth:login.identifierPlaceholder')}
              autoComplete="username"
              disabled={submitting}
              error={errors.identifier?.message}
            />
          )}
        />

        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <PasswordField
              id="login-password"
              label={t('auth:login.passwordLabel')}
              labelAccessory={
                <Link to="/forgot-password" className="kaFieldLabelLink">
                  {t('auth:login.forgotPassword')}
                </Link>
              }
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('auth:login.passwordPlaceholder')}
              autoComplete="current-password"
              disabled={submitting}
              error={errors.password?.message}
            />
          )}
        />

        <PrimaryButton type="submit" loading={submitting} loadingLabel={t('auth:login.submitting')}>
          {t('auth:login.submit')}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
