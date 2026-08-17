import { Link, useLocation } from 'react-router-dom';

import { isNavItemActive, type NavItem } from './navTypes';

interface SidebarProps {
  items: NavItem[];
  ariaLabel: string;
}

// Shared left sidebar for Seller/Admin (UIUX §10, §15) — one component, configured per role via
// `items`. Sizing/collapse behavior is pure CSS (see .karobarai-sidebar* in global.css): full
// icon+label at desktop, icon-only at tablet, hidden entirely at mobile (BottomTabBar takes over)
// — no JS breakpoint state, so there's nothing to get out of sync with the actual viewport.
// RTL: a plain flex column of links with logical (inline-start) accent/padding properties —
// the sidebar's placement on the correct side comes from being the first child in AppShell's flex
// row, which the browser mirrors automatically under `dir="rtl"` on <html>.
export function Sidebar({ items, ariaLabel }: SidebarProps) {
  const { pathname } = useLocation();

  return (
    <nav aria-label={ariaLabel} className="karobarai-sidebar">
      <ul style={{ listStyle: 'none', margin: 0, padding: 'var(--sp-4) 0' }}>
        {items.map((item) => {
          const active = isNavItemActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                to={item.to}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className="karobarai-sidebar-link"
                data-active={active || undefined}
              >
                <Icon size={20} aria-hidden="true" />
                <span className="karobarai-sidebar-label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
