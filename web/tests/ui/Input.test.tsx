import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input, SearchInput } from '@/components/ui/Input';

describe('Input', () => {
  it('emits .input class', () => {
    render(<Input placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toHaveClass('input');
  });
  it('passes native props through', () => {
    render(<Input value="hi" readOnly placeholder="z" />);
    expect(screen.getByPlaceholderText('z')).toHaveValue('hi');
  });
});

describe('SearchInput', () => {
  it('wraps input with .search and adds .input-search', () => {
    const { container } = render(<SearchInput placeholder="Find" />);
    expect(container.firstChild).toHaveClass('search');
    expect(screen.getByPlaceholderText('Find')).toHaveClass('input-search');
  });
  it('renders a search icon inside the wrapper', () => {
    const { container } = render(<SearchInput placeholder="Find" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
