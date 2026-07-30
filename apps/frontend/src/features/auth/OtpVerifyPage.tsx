import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { otpResend, otpVerify } from './authApi';
import { formatAuthError } from './authErrors';

const OTP_VALIDITY_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;

// SCR-A02 — 6-box OTP input, 10-min countdown, resend (disabled until cooldown elapses).
export function OtpVerifyPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const location = useLocation();

  const phone = (location.state as { phone?: string } | null)?.phone;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [expirySeconds, setExpirySeconds] = useState(OTP_VALIDITY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setExpirySeconds((seconds) => Math.max(0, seconds - 1));
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (!phone) {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert type="warning" showIcon message="No phone number to verify — start from Register." />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/register')}>
          {t('auth:register.title')}
        </Button>
      </div>
    );
  }

  async function handleVerify() {
    setError(null);
    setVerifying(true);
    try {
      // Tokens are issued on verify, but we don't auto-login with them — send the user to
      // Login to sign in explicitly instead of dropping them into their role home.
      await otpVerify({ phone: phone!, code });
      navigate('/login');
    } catch (err) {
      setError(formatAuthError(t, err));
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResending(true);
    try {
      const result = await otpResend({ phone: phone! });
      setExpirySeconds(result.expiresInSeconds);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(formatAuthError(t, err));
    } finally {
      setResending(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('auth:otp.title')}</Typography.Title>
      <Typography.Paragraph>{t('auth:otp.subtitle', { phone })}</Typography.Paragraph>

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      <Input.OTP length={6} value={code} onChange={setCode} style={{ marginBottom: 8 }} />
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {t('auth:otp.expiresIn', {
          minutes: Math.floor(expirySeconds / 60),
          seconds: (expirySeconds % 60).toString().padStart(2, '0'),
        })}
      </Typography.Text>

      <Button
        type="primary"
        size="large"
        block
        loading={verifying}
        disabled={code.length !== 6}
        onClick={handleVerify}
      >
        {t('auth:otp.verify')}
      </Button>

      <Button
        type="link"
        block
        disabled={resendCooldown > 0}
        loading={resending}
        onClick={handleResend}
        style={{ marginTop: 8 }}
      >
        {resendCooldown > 0 ? t('auth:otp.resendIn', { seconds: resendCooldown }) : t('auth:otp.resend')}
      </Button>
    </div>
  );
}
