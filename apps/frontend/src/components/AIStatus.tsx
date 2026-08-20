interface AIStatusProps {
  message: string;
  /** When set, renders a skeleton beneath the message shaped like the eventual result (title bar
   * + short paragraph + tag pills) instead of a blank panel — keeps the "meaningful outcome"
   * framing intact even before content arrives. Only 'listing' exists today (AI Store Builder's
   * title/description/tags shape); add shapes here as other AI results need one. */
  shape?: 'listing';
}

// UIUX §22 — the calm, honest "AI is working" state ("progress bar with honest copy... AI is
// generating your product listing…"). E5: replaced the spinning icon with a slow marigold pulse
// (thinking, not spinning) plus a thin indeterminate bar filling in brand green (work moving
// forward) — no invented loading motif, both built from existing tokens. Marigold is reserved for
// celebration/AI moments — used here as a soft accent, not decoration.
export function AIStatus({ message, shape }: AIStatusProps) {
  return (
    <div
      role="status"
      style={{
        padding: 'var(--sp-4)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--accent-marigold-soft)',
        borderInlineStart: '3px solid var(--accent-marigold)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <span
          aria-hidden="true"
          className="karobarai-ai-pulse-dot"
          style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-marigold)', flexShrink: 0 }}
        />
        <span>{message}</span>
      </div>
      <div
        aria-hidden="true"
        style={{
          marginTop: 'var(--sp-3)',
          height: 4,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--bg-surface)',
          overflow: 'hidden',
        }}
      >
        <div
          className="karobarai-ai-progress-fill"
          style={{ height: '100%', width: '30%', borderRadius: 'var(--radius-pill)', background: 'var(--brand-primary)' }}
        />
      </div>
      {shape === 'listing' && (
        <div aria-hidden="true" style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <div style={{ width: '55%', height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)' }} />
          <div style={{ width: '90%', height: 10, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)' }} />
          <div style={{ width: '75%', height: 10, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)' }} />
          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-1)' }}>
            {[56, 72, 44].map((w, i) => (
              <div key={i} style={{ width: w, height: 20, borderRadius: 'var(--radius-pill)', background: 'var(--bg-surface)' }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
