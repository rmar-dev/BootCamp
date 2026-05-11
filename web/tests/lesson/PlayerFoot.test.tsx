import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerFoot, AUTO_ADVANCE_MS } from '@/components/lesson/player/PlayerFoot';

describe('PlayerFoot', () => {
  it('exports a 3000ms AUTO_ADVANCE_MS so callers can match the CSS animation', () => {
    expect(AUTO_ADVANCE_MS).toBe(3000);
  });

  it('renders Continue label by default', () => {
    render(<PlayerFoot stepCurrent={0} stepTotal={3} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('renders Finish lesson on the last step', () => {
    render(<PlayerFoot stepCurrent={2} stepTotal={3} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByRole('button', { name: /finish lesson/i })).toBeInTheDocument();
  });

  it('disables Previous on step 0', () => {
    render(<PlayerFoot stepCurrent={0} stepTotal={3} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('does not apply auto-advancing class by default', () => {
    render(<PlayerFoot stepCurrent={1} stepTotal={3} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByRole('button', { name: /continue/i })).not.toHaveClass('auto-advancing');
  });

  it('applies auto-advancing class when prop is true', () => {
    render(
      <PlayerFoot stepCurrent={1} stepTotal={3} onPrev={() => {}} onNext={() => {}} autoAdvancing />,
    );
    expect(screen.getByRole('button', { name: /continue/i })).toHaveClass('auto-advancing');
  });

  it('renders the auto-advance-fill span (regardless of state)', () => {
    const { container } = render(
      <PlayerFoot stepCurrent={1} stepTotal={3} onPrev={() => {}} onNext={() => {}} autoAdvancing />,
    );
    expect(container.querySelector('.auto-advance-fill')).toBeTruthy();
  });

  it('manual click on Continue while auto-advancing fires onNext immediately', async () => {
    const onNext = vi.fn();
    render(
      <PlayerFoot stepCurrent={1} stepTotal={3} onPrev={() => {}} onNext={onNext} autoAdvancing />,
    );
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
