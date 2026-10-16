import type { CSSProperties, ElementType, ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  /** Rendered element — defaults to `div`. Use `nav`/`footer`/`header` where the wrapper is a landmark. */
  as?: ElementType;
  className?: string;
  id?: string;
  style?: CSSProperties;
}

// The single centered content column (max-width + responsive inline padding) shared by the
// buyer header, page sections and footer so their left/right edges always line up. Backed by the
// `.container` class in global.css (the same `--container-max` token the content area uses), so
// there is exactly one definition of "where content starts and ends".
export function Container({ children, as: Tag = 'div', className, id, style }: ContainerProps) {
  return (
    <Tag id={id} className={className ? `container ${className}` : 'container'} style={style}>
      {children}
    </Tag>
  );
}
