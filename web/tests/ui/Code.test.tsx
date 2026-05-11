import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { CodeFrame } from '@/components/ui/CodeFrame';

describe('CodeBlock', () => {
  it('renders a <pre> with .code-block', () => {
    const { container } = render(<CodeBlock>let x = 1</CodeBlock>);
    expect(container.querySelector('pre')).toHaveClass('code-block');
  });
});

describe('CodeFrame', () => {
  it('renders header tabs + body', () => {
    const { container } = render(
      <CodeFrame tabs={[{ label: 'main.swift', active: true }]}>
        <span>code</span>
      </CodeFrame>,
    );
    expect(container.firstChild).toHaveClass('code-frame');
    expect(screen.getByText('main.swift')).toHaveClass('code-tab', 'active');
  });
});
