import { useState } from 'react';
import { Mail, ShoppingBag, Store, UserPlus } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { registerSchema } from '@karobarai/shared';
import {
  AuthLayout,
  Checkbox,
  FormAlert,
  MethodTabs,
  PasswordField,
  PhoneField,
  PrimaryButton,
  RoleSelector,
  TextField,
  readAuthRole,
  writeAuthRole,
} from '../../components';
import { useLanguage } from '../../hooks';
import { register as registerAccount } from './authApi';
import { formatAuthError } from './authErrors';

type Method = 'mobile' | 'email';
type Role = 'BUYER' | 'SELLER';

interface FormValues {
  phone: string;
  email: string;
  password: string;
  agreed: boolean;
}

export function RegisterPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const { language } = useLanguage();

  const [role, setRole] = useState<Role>(readAuthRole);
  // The role cards and the brand panel story stay in step (and remember the choice).
  const chooseRole = (next: Role) => {
    setRole(next);
    writeAuthRole(next);
  };
  const [method, setMethod] = useState<Method>('mobile');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { phone: '', email: '', password: '', agreed: false } });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    // Normalize phone number (strip whitespace, ensure standard 03XX format if 10 digits)
    let cleanPhone = values.phone.replace(/[\s-]/g, '');
    if (cleanPhone.startsWith('+92')) {
      cleanPhone = '0' + cleanPhone.slice(3);
    } else if (cleanPhone.startsWith('92') && cleanPhone.length === 12) {
      cleanPhone = '0' + cleanPhone.slice(2);
    } else if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
      cleanPhone = '0' + cleanPhone;
    }

    const payload =
      method === 'mobile'
        ? { method: 'mobile' as const, role, phone: cleanPhone, password: values.password, preferredLanguage: language }
        : { method: 'email' as const, role, email: values.email.trim(), password: values.password, preferredLanguage: language };

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
        navigate('/verify-otp', { state: { phone: cleanPhone } });
        return;
      }
      navigate('/login');
    } catch (err) {
      setSubmitError(formatAuthError(t, err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthLayout
      title={t('auth:register.title')}
      subtitle={t('auth:register.subtitle')}
      icon={UserPlus}
      role={role}
      onRoleChange={chooseRole}
      footer={
        <>
          {t('auth:register.haveAccount')}{' '}
          <Link to="/login">{t('auth:register.loginLink')}</Link>
        </>
      }
    >
      <RoleSelector
        name="role"
        ariaLabel={t('auth:register.roleLegend')}
        value={role}
        onChange={chooseRole}
        options={[
          {
            value: 'BUYER',
            icon: ShoppingBag,
            title: t('auth:register.roleBuyer'),
            description: t('auth:register.buyerTagline'),
          },
          {
            value: 'SELLER',
            icon: Store,
            title: t('auth:register.roleSeller'),
            description: t('auth:register.sellerTagline'),
          },
        ]}
      />

      <MethodTabs
        name="method"
        ariaLabel={t('auth:register.methodLabel')}
        value={method}
        onChange={setMethod}
        options={[
          { value: 'mobile', label: t('auth:register.methodMobile') },
          { value: 'email', label: t('auth:register.methodEmail') },
        ]}
      />

      {submitError && <FormAlert variant="error">{submitError}</FormAlert>}

      <form onSubmit={onSubmit} noValidate>
        {method === 'mobile' ? (
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <PhoneField
                id="register-phone"
                name="phone"
                label={t('auth:register.phoneLabel')}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.phone?.message}
                placeholder={t('auth:register.phonePlaceholder')}
                autoComplete="tel"
                disabled={submitting}
                autoFocus
              />
            )}
          />
        ) : (
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <TextField
                id="register-email"
                name="email"
                label={t('auth:register.emailLabel')}
                icon={Mail}
                type="email"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.email?.message}
                placeholder={t('auth:register.emailPlaceholder')}
                autoComplete="email"
                disabled={submitting}
              />
            )}
          />
        )}

        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <PasswordField
              id="register-password"
              name="password"
              label={t('auth:register.passwordLabel')}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.password?.message}
              autoComplete="new-password"
              disabled={submitting}
              showStrength
              showChecklist
            />
          )}
        />

        <Controller
          name="agreed"
          control={control}
          rules={{ validate: (value) => value || t('auth:register.termsRequired') }}
          render={({ field }) => (
            <Checkbox
              id="register-terms"
              checked={field.value}
              onChange={field.onChange}
              error={errors.agreed?.message}
            >
              {t('auth:register.termsAgree')}
            </Checkbox>
          )}
        />

        <PrimaryButton
          type="submit"
          loading={submitting}
          loadingLabel={method === 'mobile' ? t('auth:register.sendingOtp') : t('auth:register.submitting')}
        >
          {method === 'mobile' ? t('auth:register.submitOtp') : t('auth:register.submit')}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
