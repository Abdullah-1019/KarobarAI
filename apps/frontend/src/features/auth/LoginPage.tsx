import { useState } from 'react';
import { Alert, Button, Input, Typography } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { loginSchema } from '@karobarai/shared';
import { useAuthStore } from '../../lib/authStore';
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
      navigate(roleHomePath(session.user.role));
    } catch (err) {
      setSubmitError(formatAuthError(t, err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('auth:login.title')}</Typography.Title>

      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 16 }} />}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label>{t('auth:login.identifierLabel')}</label>
          <Controller
            name="identifier"
            control={control}
            render={({ field }) => <Input {...field} size="large" />}
          />
          {errors.identifier && <Typography.Text type="danger">{errors.identifier.message}</Typography.Text>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>{t('auth:login.passwordLabel')}</label>
          <Controller
            name="password"
            control={control}
            render={({ field }) => <Input.Password {...field} size="large" />}
          />
          {errors.password && <Typography.Text type="danger">{errors.password.message}</Typography.Text>}
        </div>

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          {t('auth:login.submit')}
        </Button>
      </form>

      <Typography.Paragraph style={{ marginTop: 16, textAlign: 'center' }}>
        <Link to="/forgot-password">{t('auth:login.forgotPassword')}</Link>
      </Typography.Paragraph>
      <Typography.Paragraph style={{ textAlign: 'center' }}>
        {t('auth:login.noAccount')} <Link to="/register">{t('auth:login.registerLink')}</Link>
      </Typography.Paragraph>
    </div>
  );
}
