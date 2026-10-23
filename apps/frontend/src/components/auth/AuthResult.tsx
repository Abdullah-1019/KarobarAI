import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type AuthResultVariant = 'success' | 'error';

export interface AuthResultProps {
  variant?: AuthResultVariant;
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Action(s) rendered full-width below the copy. */
  children?: ReactNode;
}

// Full-state panel for terminal outcomes (reset link sent, password updated, expired token, ...):
// a centered icon medallion that pops in with a soft halo, a heading, supporting copy and one or more actions.
export function AuthResult({ variant = 'success', icon: Icon, title, description, children }: AuthResultProps) {
  return (
    <div className="kaResult">
      <span className={`kaResultIcon kaResultIcon--${variant}`} aria-hidden="true">
        <Icon size={30} strokeWidth={2.2} />
      </span>
      <h1 className="kaResultTitle">{title}</h1>
      {description ? <p className="kaResultDesc">{description}</p> : null}
      {children ? <div className="kaResultActions">{children}</div> : null}
    </div>
  );
}
