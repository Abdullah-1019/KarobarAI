import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface Crumb {
  label: string;
  to?: string;
}

interface BreadcrumbProps {
  items: Crumb[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className} style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
      <ol style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          const isHome = item.label.toLowerCase() === 'home';
          return (
            <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              {idx > 0 && <ChevronRight className="breadcrumb-sep" size={14} strokeWidth={1.75} aria-hidden="true" />}
              {isLast ? (
                <span aria-current="page" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
              ) : item.to ? (
                <Link to={item.to} style={{ color: 'inherit', textDecoration: 'none' }}>{isHome ? <Home size={14} strokeWidth={1.75} aria-hidden="true" /> : item.label}</Link>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
