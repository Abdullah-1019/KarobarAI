import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useLanguage } from '../hooks';

interface BackLinkProps {
  to: string;
  label: string;
}

// Shared "back to list" link — was duplicated verbatim (a bare "← {label}" string) across
// catalog screens. Uses a real Lucide icon rather than a text glyph, and mirrors per UIUX §7
// ("directional icons... mirror in RTL") since a back-arrow is directional, unlike the icons in
// StatusTag.
export function BackLink({ to, label }: BackLinkProps) {
  const { dir } = useLanguage();
  const Icon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-1)',
        color: 'var(--brand-primary)',
      }}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </Link>
  );
}
