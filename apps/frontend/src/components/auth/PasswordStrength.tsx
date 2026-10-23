import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { scorePassword } from './passwordScore';

const LEVEL_LABEL = ['', 'weak', 'fair', 'good', 'strong'] as const;

export function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation(['common']);
  const score = scorePassword(password);
  const labelKey = LEVEL_LABEL[score];

  return (
    <div className="kaStrength" data-level={score}>
      <div className="kaStrengthSegs" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => (
          <span key={segment} className="kaStrengthSeg" />
        ))}
      </div>
      <span className="kaStrengthLabel" aria-live="polite">
        {score > 0 ? t(`common:passwordStrength.${labelKey}`) : null}
      </span>
    </div>
  );
}

const RULES = [
  { key: 'length', test: (p: string) => p.length >= 8 },
  { key: 'case', test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { key: 'number', test: (p: string) => /\d/.test(p) },
  { key: 'special', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

// The four-rule checklist beneath a password field: a fixed 2×2 grid of chips that is always laid
// out (no collapsing max-height), so the form never jumps — only each chip's colour changes as a
// rule is met.
export function PasswordChecklist({ password }: { password: string }) {
  const { t } = useTranslation(['auth']);

  return (
    <ul className="kaChecklist">
      {RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.key} className="kaChecklistItem" data-met={met}>
            <span className="kaChecklistMark" aria-hidden="true">
              <Check size={11} strokeWidth={3} />
            </span>
            {t(`auth:controls.checklist.${rule.key}`)}
          </li>
        );
      })}
    </ul>
  );
}
