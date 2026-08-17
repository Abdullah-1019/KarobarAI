import { useEffect, useState } from 'react';
import axios from 'axios';

import { apiRootUrl } from '../api/client';

type Status = 'checking' | 'ok' | 'unreachable';

// Dev-only connectivity confirmation (Day 2: "confirm the app shell connects to /health") — not
// a feature, just a local-dev sanity badge. Never rendered in production builds.
export function HealthIndicator() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${apiRootUrl}/health`)
      .then(() => {
        if (!cancelled) setStatus('ok');
      })
      .catch(() => {
        if (!cancelled) setStatus('unreachable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const color = status === 'ok' ? 'var(--success)' : status === 'unreachable' ? 'var(--error)' : 'var(--text-secondary)';
  const label =
    status === 'ok' ? 'API: connected' : status === 'unreachable' ? 'API: unreachable' : 'API: checking…';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--sp-3)',
        insetInlineEnd: 'var(--sp-3)',
        zIndex: 'var(--z-toast)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-1)',
        padding: '4px var(--sp-2)',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        fontSize: 'var(--fs-xs)',
        color: 'var(--text-secondary)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </div>
  );
}
