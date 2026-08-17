import { Loader2 } from 'lucide-react';

interface AIStatusProps {
  message: string;
}

// UIUX §22 — the calm, honest "AI is working" state ("progress bar with honest copy... AI is
// generating your product listing…"). Marigold is reserved for celebration/AI moments (§5.1,
// §12) — used once here as a soft accent, not decoration. One icon, not "sparkles everywhere."
export function AIStatus({ message }: AIStatusProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-4)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--accent-marigold-soft)',
        borderInlineStart: '3px solid var(--accent-marigold)',
      }}
    >
      <Loader2 size={20} aria-hidden="true" className="karobarai-spin" style={{ color: 'var(--accent-marigold)', flexShrink: 0 }} />
      <span>{message}</span>
    </div>
  );
}
