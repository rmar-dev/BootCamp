import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from '@/components/layout/AppShell';

describe('AppShell (heading-bar shim)', () => {
  it('renders title and subtitle when both are provided', () => {
    render(
      <AppShell title="Dashboard" subtitle="Today's plan">
        <span data-testid="child">child</span>
      </AppShell>,
    );
    expect(screen.getByText('Dashboard')).toHaveClass('h-display');
    expect(screen.getByText("Today's plan")).toBeTruthy();
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('renders title only when subtitle is omitted', () => {
    render(
      <AppShell title="Tracks">
        <span data-testid="child">child</span>
      </AppShell>,
    );
    expect(screen.getByText('Tracks')).toBeTruthy();
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('renders children only when neither title nor subtitle is provided', () => {
    const { container } = render(
      <AppShell>
        <span data-testid="child">child</span>
      </AppShell>,
    );
    expect(container.querySelector('header')).toBeNull();
    expect(screen.getByTestId('child')).toBeTruthy();
  });
});
