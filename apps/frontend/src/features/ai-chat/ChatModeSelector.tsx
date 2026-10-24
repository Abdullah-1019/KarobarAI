import { Cpu, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ChatMode } from './chatMode';
import './ChatModeSelector.css';

interface ChatModeSelectorProps {
  value: ChatMode;
  onChange: (mode: ChatMode) => void;
  /** Locked while a reply or cart action is in flight, so a request never changes mode midway. */
  disabled?: boolean;
}

const OPTIONS = [
  { mode: 'fast' as const, icon: Zap },
  { mode: 'slow' as const, icon: Cpu },
];

// Two-segment switch between Fast Mode (Gemini) and Slow Mode (local Ollama), with one line
// explaining the selected mode. Shared by the buyer store chat and the seller assistant.
export function ChatModeSelector({ value, onChange, disabled = false }: ChatModeSelectorProps) {
  const { t } = useTranslation('common');
  return (
    <div className="chat-mode">
      <div className="chat-mode__switch" role="radiogroup" aria-label={t('aiMode.label')}>
        {OPTIONS.map(({ mode, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value === mode}
            className={`chat-mode__option${value === mode ? ' is-active' : ''}`}
            disabled={disabled}
            onClick={() => { if (value !== mode) onChange(mode); }}
          >
            <Icon size={14} aria-hidden="true" />
            <span>{t(`aiMode.${mode}`)}</span>
          </button>
        ))}
      </div>
      <p className="chat-mode__hint">{t(`aiMode.${value}Hint`)}</p>
    </div>
  );
}
