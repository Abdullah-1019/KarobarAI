import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChatMarkdown } from './ChatMarkdown';

describe('safe AI Markdown', () => {
  it('renders lists and code without interpreting model HTML', () => {
    const view = render(<ChatMarkdown content={'- one\n- two\n\n```ts\nconst x = 1\n```\n<script>alert(1)</script>'} />);
    expect(screen.getByText('one').closest('li')).toBeTruthy();
    expect(screen.getByText('const x = 1').closest('code')).toBeTruthy();
    expect(view.container.querySelector('script')).toBeNull();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });
});
