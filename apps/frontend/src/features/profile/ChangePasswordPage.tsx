import { useState } from 'react';
import { Alert, Button } from 'antd';
import { Check, KeyRound, LogOut, ShieldCheck, X } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { changePasswordSchema } from '@karobarai/shared';
import { PasswordField } from '../../components';
import { ApiError } from '../../api';
import { useAuthStore } from '../../lib/authStore';
import { changePassword } from './profileApi';
import { formatProfileError } from './profileErrors';
import '../../components/auth/auth.css';
import './profile.css';
import './settings.css';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// F2-profiles-backend.md: on success every *other* session/device is revoked, but this device
// gets a fresh token pair and stays logged in — must show the "signed out elsewhere" messaging
// (same requirement as auth's reset-password) without actually logging this session out.
// Uses the auth screens' PasswordField (reveal toggle, strength meter, rule checklist).
export function ChangePasswordPage() {
  const { t } = useTranslation(['profile', 'common']);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const profilePath = user?.role === 'SELLER' ? '/seller/profile' : '/buyer/profile';

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const newPassword = watch('newPassword');
  const confirm = watch('confirmNewPassword');

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
        setError(field, { message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      const { accessToken } = await changePassword(parsed.data);
      // user identity doesn't change here — reuse what's already in the store, just rotate the token.
      if (user) setSession(accessToken, user);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CURRENT_PASSWORD') {
        setError('currentPassword', { message: t('profile:changePassword.invalidCurrentPassword') });
      } else {
        setSubmitError(formatProfileError(t, err));
      }
    } finally {
      setSubmitting(false);
    }
  });

  if (done) {
    return (
      <div className="pfPage stPage">
        <section className="stCard cpDone" role="status">
          <span className="cpDoneMark" aria-hidden="true"><Check size={30} strokeWidth={3} /></span>
          <h1 className="stTitle">{t('profile:changePassword.successTitle')}</h1>
          <p className="stSub">{t('profile:changePassword.successSignedOutEverywhere')}</p>
          <Button type="primary" onClick={() => navigate(profilePath)}>{t('profile:changePasswordUi.backToProfile')}</Button>
        </section>
      </div>
    );
  }

  const confirmState = confirm ? (confirm === newPassword ? 'match' : 'mismatch') : null;

  return (
    <div className="pfPage stPage">
      <header className="stHead">
        <h1 className="stTitle">{t('profile:changePassword.title')}</h1>
        <p className="stSub">{t('profile:changePasswordUi.subtitle')}</p>
      </header>

      <div className="cpLayout">
        <aside className="cpAside">
          <span className="cpAsideIcon" aria-hidden="true"><ShieldCheck size={26} /></span>
          <h2 className="stCardTitle">{t('profile:changePasswordUi.tipsTitle')}</h2>
          <ul className="cpTips">
            <li><KeyRound size={16} aria-hidden="true" />{t('profile:changePasswordUi.tipStrong')}</li>
            <li><X size={16} aria-hidden="true" />{t('profile:changePasswordUi.tipReuse')}</li>
            <li><LogOut size={16} aria-hidden="true" />{t('profile:changePasswordUi.tipDevices')}</li>
          </ul>
        </aside>

        <section className="stCard cpForm">
          {submitError && <Alert type="error" message={submitError} showIcon />}
          <form onSubmit={onSubmit} className="cpFields" noValidate>
            <Controller
              name="currentPassword"
              control={control}
              render={({ field }) => (
                <PasswordField
                  id="change-password-current"
                  label={t('profile:changePassword.currentPasswordLabel')}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  autoComplete="current-password"
                  error={errors.currentPassword?.message}
                />
              )}
            />
            <Controller
              name="newPassword"
              control={control}
              render={({ field }) => (
                <PasswordField
                  id="change-password-new"
                  label={t('profile:changePassword.newPasswordLabel')}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  autoComplete="new-password"
                  error={errors.newPassword?.message}
                  showStrength
                  showChecklist
                />
              )}
            />
            <Controller
              name="confirmNewPassword"
              control={control}
              render={({ field }) => (
                <PasswordField
                  id="change-password-confirm"
                  label={t('profile:changePassword.confirmNewPasswordLabel')}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  autoComplete="new-password"
                  error={errors.confirmNewPassword?.message}
                />
              )}
            />
            {confirmState && !errors.confirmNewPassword && (
              <p className="cpMatch" data-state={confirmState} aria-live="polite">
                {confirmState === 'match' ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                {t(confirmState === 'match' ? 'profile:changePasswordUi.match' : 'profile:changePasswordUi.noMatch')}
              </p>
            )}
            <div className="cpActions">
              <Button htmlType="button" onClick={() => navigate(profilePath)}>{t('common:actions.cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {t('profile:changePassword.submit')}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
