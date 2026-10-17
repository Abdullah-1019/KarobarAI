import { useState } from 'react';

interface StoreMonogramProps {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}

// A store's mark: its uploaded logo when there is one, otherwise the first letter of its name in
// Outfit on a peach disc. Most small sellers never upload a logo, so the initial is the common
// case and has to look intended, not like a missing avatar. Decorative: the name is always beside it.
export function StoreMonogram({ name, logoUrl, size = 56, className }: StoreMonogramProps) {
  const [failed, setFailed] = useState(false);
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '·';

  return (
    <span
      className={['store-mark', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
      aria-hidden="true"
    >
      {logoUrl && !failed ? <img src={logoUrl} alt="" onError={() => setFailed(true)} /> : initial}
    </span>
  );
}
