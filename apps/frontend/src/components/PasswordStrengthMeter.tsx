import { useTranslation } from 'react-i18next';

interface PasswordStrengthMeterProps {
  password: string;
}

// Reflects the exact REQ-F-Auth002 rule (>=8 chars, upper+lower+digit+special) shared via
// packages/shared's passwordSchema — Register (SCR-A01) and, later, Profile's Change Password
// both need this same meter, which is why it lives here rather than in features/auth.
function scorePassword(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const LEVEL_KEYS = ['tooWeak', 'weak', 'fair', 'good', 'strong'] as const;
const LEVEL_COLOR: Record<(typeof LEVEL_KEYS)[number], string> = {
  tooWeak: 'var(--error)',
  weak: 'var(--error)',
  fair: 'var(--warning)',
  good: 'var(--warning)',
  strong: 'var(--success)',
};

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const { t } = useTranslation(['common']);
  if (!password) return null;
  const score = scorePassword(password);
  const levelKey = LEVEL_KEYS[Math.max(0, score - 1)] ?? LEVEL_KEYS[0];
  const color = LEVEL_COLOR[levelKey];

  return (
    <div style={{ marginTop: 'var(--sp-1)' }}>
      <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
        {LEVEL_KEYS.map((_, index) => (
          <span
            key={index}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 'var(--radius-pill)',
              background: index < score ? color : 'var(--bg-sunken)',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 'var(--fs-xs)', color }}>{t(`passwordStrength.${levelKey}`)}</span>
    </div>
  );
}
