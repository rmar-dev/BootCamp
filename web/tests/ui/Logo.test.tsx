import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo } from '@/components/ui/Logo';

describe('Logo', () => {
  it('renders .logo with mark and wordmark', () => {
    const { container } = render(<Logo />);
    expect(container.firstChild).toHaveClass('logo');
    expect(container.querySelector('.logo-mark')).not.toBeNull();
    expect(screen.getByText('BootCamp')).toBeTruthy();
  });
  it('size="sm" adds .logo-sm', () => {
    const { container } = render(<Logo size="sm" />);
    expect(container.firstChild).toHaveClass('logo-sm');
  });
  it('respects custom label', () => {
    render(<Logo label="MyApp" />);
    expect(screen.getByText('MyApp')).toBeTruthy();
  });
});
