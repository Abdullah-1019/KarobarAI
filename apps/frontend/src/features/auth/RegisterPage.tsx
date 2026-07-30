import { useState } from 'react';
import { Alert, Button, Input, Segmented, Typography } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { registerSchema, type UserRole } from '@karobarai/shared';
import { PasswordStrengthMeter } from '../../components';
import { useLanguage } from '../../hooks';
import { register as registerAccount } from './authApi';
import { formatAuthError } from './authErrors';

type Method = 'mobile' | 'email';

interface FormValues {
  phone: string;
  email: string;
  password: string;
}

// SCR-A01 — role toggle, method tabs, phone/email, password + strength meter, language switch.
// Fields use RHF's <Controller>, not uncontrolled `register()` — AntD's Input forwards a ref to
// a wrapper object (focus/blur/input), not the raw DOM node, so uncontrolled register() reads
// the wrong `.value` on submit.
export function RegisterPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();

  const [role, setRole] = useState<UserRole>('BUYER');
  const [method, setMethod] = useState<Method>('mobile');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { phone: '', email: '', password: '' } });

  const password = watch('password');

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const payload =
      method === 'mobile'
        ? { method: 'mobile' as const, role, phone: values.phone, password: values.password }
        : { method: 'email' as const, role, email: values.email, password: values.password };

    const parsed = registerSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
        if (field === 'phone' || field === 'email' || field === 'password') {
          setError(field, { message: issue.message });
        }
      }
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerAccount(parsed.data);
      if (result.kind === 'pending_verification') {
        navigate('/verify-otp', { state: { phone: values.phone } });
        return;
      }
      // Email registration issues tokens immediately, but we don't auto-login with them — send
      // the user to Login to sign in explicitly rather than dropping them straight into their
      // role home (buyer storefront / seller onboarding).
      navigate('/login');
    } catch (err) {
      setSubmitError(formatAuthError(t, err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Segmented
          size="small"
          value={language}
          onChange={(value) => setLanguage(value as 'EN' | 'UR')}
          options={[
            { label: 'EN', value: 'EN' },
            { label: 'اردو', value: 'UR' },
          ]}
        />
      </div>

      <Typography.Title level={3}>{t('auth:register.title')}</Typography.Title>

      <Segmented
        block
        value={role}
        onChange={(value) => setRole(value as UserRole)}
        options={[
          { label: t('auth:register.roleBuyer'), value: 'BUYER' },
          { label: t('auth:register.roleSeller'), value: 'SELLER' },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Segmented
        block
        value={method}
        onChange={(value) => setMethod(value as Method)}
        options={[
          { label: t('auth:register.methodMobile'), value: 'mobile' },
          { label: t('auth:register.methodEmail'), value: 'email' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 16 }} />}

      <form onSubmit={onSubmit}>
        {method === 'mobile' ? (
          <div style={{ marginBottom: 16 }}>
            <label>{t('auth:register.phoneLabel')}</label>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => <Input {...field} size="large" placeholder="03001234567" />}
            />
            {errors.phone && <Typography.Text type="danger">{errors.phone.message}</Typography.Text>}
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label>{t('auth:register.emailLabel')}</label>
            <Controller
              name="email"
              control={control}
              render={({ field }) => <Input {...field} size="large" type="email" />}
            />
            {errors.email && <Typography.Text type="danger">{errors.email.message}</Typography.Text>}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label>{t('auth:register.passwordLabel')}</label>
          <Controller
            name="password"
            control={control}
            render={({ field }) => <Input.Password {...field} size="large" />}
          />
          <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
            {t('auth:register.passwordHelp')}
          </Typography.Text>
          <PasswordStrengthMeter password={password ?? ''} />
          {errors.password && <Typography.Text type="danger">{errors.password.message}</Typography.Text>}
        </div>

        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          {t('auth:register.submit')}
        </Button>
      </form>

      <Typography.Paragraph style={{ marginTop: 16, textAlign: 'center' }}>
        {t('auth:register.haveAccount')} <Link to="/login">{t('auth:register.loginLink')}</Link>
      </Typography.Paragraph>
    </div>
  );
}
