import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Reveal } from './Reveal';

// jsdom has no IntersectionObserver, which is exactly the "unsupported" branch of useInView — the
// hook must fall back to visible so content is never trapped at opacity:0.
describe('Reveal', () => {
  it('renders children in a .reveal wrapper and marks it visible on the fallback path', () => {
    render(<Reveal>Hello</Reveal>);

    const el = screen.getByText('Hello');
    expect(el).toHaveClass('reveal');
    expect(el).toHaveClass('is-visible');
  });

  it('renders the requested tag and merges extra classes', () => {
    render(
      <Reveal as="section" className="custom">
        Body
      </Reveal>,
    );

    const el = screen.getByText('Body');
    expect(el.tagName).toBe('SECTION');
    expect(el).toHaveClass('reveal', 'custom');
  });

  it('applies the stagger delay as a transition delay', () => {
    render(<Reveal delay={120}>Delayed</Reveal>);

    expect(screen.getByText('Delayed')).toHaveStyle({ transitionDelay: '120ms' });
  });
});
