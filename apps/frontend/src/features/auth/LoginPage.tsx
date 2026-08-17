import { useState } from 'react';
import { Alert, Button, Input, Typography } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { loginSchema } from '@karobarai/shared';
import { useAuthStore } from '../../lib/authStore';
import { useLanguageStore } from '../../lib/languageStore';
import { AuthLayout } from './AuthLayout';
import { login } from './authApi';
import { formatAuthError } from './authErrors';
import { roleHomePath } from './roleHome';

interface FormValues {
  identifier: string;
  password: string;
}

// SCR-A03 — identifier + password. Deliberately never distinguishes "no such account" from
// "wrong password" (HO-F1-Auth.md: identical response either way — no user enumeration).
// Uses RHF's <Controller>, not uncontrolled register() — see RegisterPage.tsx for why.
export function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);

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
      // Apply the account's saved language on login, same as session-restore does on boot.
      useLanguageStore.getState().setLanguage(session.user.preferredLanguage);
      // Buy Now as a guest lands here with a `redirect` state (ProductDetailPage/CartPage) so
      // login sends them back to Checkout instead of always to their role home.
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
      footer={
        <>
          <Typography.Paragraph style={{ marginBottom: 'var(--sp-2)' }}>
            <Link to="/forgot-password">{t('auth:login.forgotPassword')}</Link>
          </Typography.Paragraph>
          <Typography.Paragraph style={{ margin: 0 }}>
            {t('auth:login.noAccount')} <Link to="/register">{t('auth:login.registerLink')}</Link>
          </Typography.Paragraph>
        </>
      }
    >
      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 'var(--sp-4)' }} />}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label htmlFor="login-identifier">{t('auth:login.identifierLabel')}</label>
          <Controller
            name="identifier"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="login-identifier"
                size="large"
                aria-invalid={!!errors.identifier}
                aria-describedby={errors.identifier ? 'login-identifier-error' : undefined}
              />
            )}
          />
          {errors.identifier && (
            <Typography.Text id="login-identifier-error" type="danger">
              {errors.identifier.message}
            </Typography.Text>
          )}
        </div>

        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label htmlFor="login-password">{t('auth:login.passwordLabel')}</label>
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <Input.Password
                {...field}
                id="login-password"
                size="large"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
              />
            )}
          />
          {errors.password && (
            <Typography.Text id="login-password-error" type="danger">
              {errors.password.message}
            </Typography.Text>
          )}
        </div>

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          {t('auth:login.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
