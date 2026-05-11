import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TweaksPanel, TweakSection, TweakRadio } from '@/components/ui/TweaksPanel';

describe('TweaksPanel', () => {
  it('renders title bar and child sections', () => {
    render(
      <TweaksPanel title="Tweaks" defaultOpen>
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value="dark" options={['dark', 'light']} onChange={() => {}} />
      </TweaksPanel>,
    );
    expect(screen.getByText('Tweaks')).toBeTruthy();
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Theme')).toBeTruthy();
  });

  it('TweakRadio invokes onChange when a non-active option is clicked', async () => {
    const onChange = vi.fn();
    render(<TweakRadio label="Theme" value="dark" options={['dark', 'light']} onChange={onChange} />);
    await userEvent.click(screen.getByText('light'));
    expect(onChange).toHaveBeenCalledWith('light');
  });
});
