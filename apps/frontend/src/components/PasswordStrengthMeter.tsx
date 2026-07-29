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

const LEVELS = [
  { label: 'Too weak', color: 'var(--error)' },
  { label: 'Weak', color: 'var(--error)' },
  { label: 'Fair', color: 'var(--warning)' },
  { label: 'Good', color: 'var(--warning)' },
  { label: 'Strong', color: 'var(--success)' },
];

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;
  const score = scorePassword(password);
  const level = LEVELS[Math.max(0, score - 1)] ?? LEVELS[0]!;

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {LEVELS.map((_, index) => (
          <span
            key={index}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 'var(--radius-pill, 999px)',
              background: index < score ? level.color : 'var(--bg-sunken)',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 'var(--fs-xs, 12px)', color: level.color }}>{level.label}</span>
    </div>
  );
}
