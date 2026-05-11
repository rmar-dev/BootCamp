import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPI } from '@/components/ui/KPI';

describe('KPI', () => {
  it('renders label, value, and optional delta inside .kpi', () => {
    const { container } = render(<KPI label="Streak" value="12" delta="+1 today" />);
    expect(container.firstChild).toHaveClass('kpi');
    expect(screen.getByText('Streak')).toHaveClass('kpi-label');
    expect(screen.getByText('12')).toHaveClass('kpi-value');
    expect(screen.getByText('+1 today')).toHaveClass('kpi-delta');
  });
  it('peacock=true adds .peacock-text to value', () => {
    render(<KPI label="X" value="9" peacock />);
    expect(screen.getByText('9')).toHaveClass('peacock-text');
  });
});
