import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerHead } from '@/components/lesson/player/PlayerHead';
import { PlayerFoot } from '@/components/lesson/player/PlayerFoot';
import { PlayerBody } from '@/components/lesson/player/PlayerBody';

describe('PlayerHead', () => {
  it('renders progress text and back-to-track button', async () => {
    const onBack = vi.fn();
    render(
      <PlayerHead
        title="Lesson 08 · Concept check"
        stepCurrent={2}
        stepTotal={5}
        hexStates={['first_try', 'eventual', 'unattempted']}
        onBackToTrack={onBack}
      />,
    );
    expect(screen.getByText(/Lesson 08/)).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
    expect(screen.getByLabelText(/Hex score/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back to track/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('hides the hex bar when hexStates is undefined', () => {
    render(
      <PlayerHead title="x" stepCurrent={1} stepTotal={1} onBackToTrack={() => {}} />,
    );
    expect(screen.queryByLabelText(/Hex score/i)).not.toBeInTheDocument();
  });
});

describe('PlayerFoot', () => {
  it('disables Previous on the first step and Continue advances', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <PlayerFoot stepCurrent={0} stepTotal={5} onPrev={onPrev} onNext={onNext} />,
    );
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onNext).toHaveBeenCalled();
  });

  it('shows "Finish lesson" copy on the last step', () => {
    render(
      <PlayerFoot stepCurrent={4} stepTotal={5} onPrev={() => {}} onNext={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /finish lesson/i })).toBeInTheDocument();
  });
});

describe('PlayerBody', () => {
  it('renders children inside the body wrapper', () => {
    const { container } = render(
      <PlayerBody>
        <span>hi</span>
      </PlayerBody>,
    );
    expect(container.querySelector('.player-body')).toBeInTheDocument();
    expect(container.textContent).toContain('hi');
  });
});
