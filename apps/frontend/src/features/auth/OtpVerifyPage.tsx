import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { AuthLayout, AuthResult, FormAlert, OtpInput, PrimaryButton } from '../../components';
import { otpResend, otpVerify } from './authApi';
import { formatAuthError } from './authErrors';

const OTP_VALIDITY_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_MAX_PER_HOUR = 5;

// Keeps the first 3 and last 2 digits visible: "03001234567" -> "030••••••67".
function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 3)}${'•'.repeat(phone.length - 5)}${phone.slice(-2)}`;
}

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
  const [resendCount, setResendCount] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setExpirySeconds((seconds) => Math.max(0, seconds - 1));
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleVerify = useCallback(
    async (codeToVerify?: string) => {
      const targetCode = codeToVerify ?? code;
      if (targetCode.length !== 6 || inFlight.current) return;

      inFlight.current = true;
      setError(null);
      setVerifying(true);
      try {
        await otpVerify({ phone: phone!, code: targetCode });
        navigate('/login');
      } catch (err) {
        setError(formatAuthError(t, err));
      } finally {
        setVerifying(false);
        inFlight.current = false;
      }
    },
    [code, phone, navigate, t],
  );

  const handleCodeChange = (value: string) => {
    setCode(value);
    if (error) setError(null);
  };

  async function handleResend() {
    if (resendCooldown > 0 || resending || resendCount >= RESEND_MAX_PER_HOUR) return;
    setError(null);
    setResending(true);
    try {
      const result = await otpResend({ phone: phone! });
      setExpirySeconds(result.expiresInSeconds);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setResendCount((count) => count + 1);
    } catch (err) {
      setError(formatAuthError(t, err));
    } finally {
      setResending(false);
    }
  }

  if (!phone) {
    return (
      <AuthLayout>
        <AuthResult
          variant="error"
          icon={ShieldCheck}
          title={t('auth:otp.title')}
          description={t('auth:otp.noPhoneToVerify')}
        >
          <PrimaryButton onClick={() => navigate('/register')}>{t('auth:register.title')}</PrimaryButton>
        </AuthResult>
      </AuthLayout>
    );
  }

  const minutes = String(Math.floor(expirySeconds / 60)).padStart(2, '0');
  const seconds = String(expirySeconds % 60).padStart(2, '0');
  const resendLimitReached = resendCount >= RESEND_MAX_PER_HOUR;

  return (
    <AuthLayout
      title={t('auth:otp.title')}
      subtitle={t('auth:otp.subtitle', { phone: `\u2066${maskPhone(phone)}\u2069` })}
      icon={ShieldCheck}
      footer={
        <button type="button" className="kaTextButton" onClick={() => navigate('/register')}>
          {t('auth:otp.changePhone')}
        </button>
      }
    >
      {error && <FormAlert variant="error">{error}</FormAlert>}

      <OtpInput
        value={code}
        onChange={handleCodeChange}
        onComplete={handleVerify}
        invalid={!!error}
        disabled={verifying}
        autoFocus
      />

      <div className="kaOtpMeta">
        <Clock size={14} aria-hidden="true" />
        <span>{t('auth:otp.expiresIn', { minutes, seconds })}</span>
      </div>

      <PrimaryButton loading={verifying} disabled={code.length !== 6} onClick={() => handleVerify()}>
        {t('auth:otp.verify')}
      </PrimaryButton>

      <div className="kaResendRow">
        {resendLimitReached ? (
          <span>{t('auth:otp.resendLimitReached')}</span>
        ) : resendCooldown > 0 ? (
          <span>{t('auth:otp.resendIn', { seconds: resendCooldown })}</span>
        ) : (
          <button type="button" className="kaTextButton" onClick={handleResend} disabled={resending}>
            {t('auth:otp.resend')}
          </button>
        )}
      </div>
    </AuthLayout>
  );
}
