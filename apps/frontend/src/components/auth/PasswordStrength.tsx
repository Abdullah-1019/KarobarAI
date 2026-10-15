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
      {score > 0 && (
        <span className="kaStrengthLabel">
          {t(`common:passwordStrength.${labelKey}`)}
        </span>
      )}
    </div>
  );
}

const RULES = [
  { key: 'length', test: (p: string) => p.length >= 8 },
  { key: 'case', test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { key: 'number', test: (p: string) => /\d/.test(p) },
  { key: 'special', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

// The four-item rule checklist beneath a password field, expanded while the field is focused.
export function PasswordChecklist({ password, visible }: { password: string; visible: boolean }) {
  const { t } = useTranslation(['auth']);

  return (
    <ul className="kaChecklist" data-visible={visible}>
      {RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.key} className="kaChecklistItem" data-met={met}>
            <Check size={14} aria-hidden="true" />
            {t(`auth:controls.checklist.${rule.key}`)}
          </li>
        );
      })}
    </ul>
  );
}
