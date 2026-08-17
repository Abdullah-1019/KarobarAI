import { Link, useLocation } from 'react-router-dom';

import { isNavItemActive, type NavItem } from './navTypes';

interface BottomTabBarProps {
  items: NavItem[];
  ariaLabel: string;
}

// Shared mobile bottom navigation for all three roles (UIUX §10, §15, §30) — one component,
// configured per role via `items` (max 5 per §15). Fixed to the viewport bottom via CSS
// (.karobarai-bottom-tabs in global.css), hidden at >=768px where the Sidebar/top-nav takes over;
// AppShell's content area reserves matching bottom padding at that same breakpoint so the bar
// never covers page content. `inset-inline: 0` (not left/right) and `env(safe-area-inset-bottom)`
// live in the CSS class.
export function BottomTabBar({ items, ariaLabel }: BottomTabBarProps) {
  const { pathname } = useLocation();

  return (
    <nav aria-label={ariaLabel} className="karobarai-bottom-tabs">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            to={item.to}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className="karobarai-bottom-tab"
            data-active={active || undefined}
          >
            <span className="karobarai-bottom-tab-icon">
              <Icon size={22} aria-hidden="true" />
              {!!item.badge && <span className="karobarai-bottom-tab-badge">{item.badge > 9 ? '9+' : item.badge}</span>}
            </span>
            <span className="karobarai-bottom-tab-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
