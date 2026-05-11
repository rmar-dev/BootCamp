import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

describe('SegmentedControl', () => {
  it('renders options and marks the active one', () => {
    render(
      <SegmentedControl
        value="swift"
        onChange={() => {}}
        options={[
          { value: 'swift', label: 'Swift', activeClassName: 'swift' },
          { value: 'kotlin', label: 'Kotlin' },
        ]}
      />,
    );
    expect(screen.getByText('Swift')).toHaveClass('seg-btn', 'active', 'swift');
    expect(screen.getByText('Kotlin')).toHaveClass('seg-btn');
    expect(screen.getByText('Kotlin')).not.toHaveClass('active');
  });

  it('invokes onChange when a non-active option is clicked', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        value="swift"
        onChange={onChange}
        options={[
          { value: 'swift', label: 'Swift' },
          { value: 'kotlin', label: 'Kotlin' },
        ]}
      />,
    );
    await userEvent.click(screen.getByText('Kotlin'));
    expect(onChange).toHaveBeenCalledWith('kotlin');
  });
});
