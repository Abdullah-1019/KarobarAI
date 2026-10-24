import { useEffect, useState } from 'react';
import axios from 'axios';

import { apiRootUrl } from '../api/client';

type Status = 'checking' | 'ok' | 'unreachable';

// Dev-only connectivity confirmation (Day 2: "confirm the app shell connects to /health") — not
// a feature, just a local-dev sanity badge. Never rendered in production builds.
export function HealthIndicator() {
  const [status, setStatus] = useState<Status>('checking');

  // Re-checks every 10s while unreachable, so a page opened before the API finished starting
  // clears itself instead of showing a stale badge until refresh.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      axios
        .get(`${apiRootUrl}/health`)
        .then(() => {
          if (!cancelled) setStatus('ok');
        })
        .catch(() => {
          if (cancelled) return;
          setStatus('unreachable');
          timer = setTimeout(check, 10_000);
        });
    };
    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Per the auth redesign spec §7: the badge is a dev-only troubleshooting aid, and it only shows
  // when the health check actually fails. A reachable API (or a production build) renders nothing.
  if (!import.meta.env.DEV || status !== 'unreachable') {
    return null;
  }

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
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--error)', display: 'inline-block' }} />
      API: unreachable
    </div>
  );
}
