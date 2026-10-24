import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';

export interface NavItem {
  key: string;
  to: string;
  label: string;
  icon: ComponentType<LucideProps>;
  /** Count badge on the icon (cart items, unread messages, AI replies) — omitted or 0 renders none. */
  badge?: number;
  /**
   * Match `to` exactly rather than as a path prefix. Needed for a role's root path (e.g.
   * `/seller`) — without it, every `/seller/*` route (including the other nav items' own
   * routes) would also match as active, since they all start with `/seller`.
   */
  exact?: boolean;
}

// Shared by Sidebar and BottomTabBar so "which item is active" is one rule, not two.
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
