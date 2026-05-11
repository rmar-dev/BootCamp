import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Stack } from '@/components/ui/Stack';
import { Row } from '@/components/ui/Row';

describe('Stack', () => {
  it('emits .stack by default', () => {
    const { container } = render(<Stack>x</Stack>);
    expect(container.firstChild).toHaveClass('stack');
  });
  it('gap="tight" adds .stack-tight; gap="loose" adds .stack-loose', () => {
    const { container, rerender } = render(<Stack gap="tight">x</Stack>);
    expect(container.firstChild).toHaveClass('stack-tight');
    rerender(<Stack gap="loose">x</Stack>);
    expect(container.firstChild).toHaveClass('stack-loose');
  });
});

describe('Row', () => {
  it('emits .row by default', () => {
    const { container } = render(<Row>x</Row>);
    expect(container.firstChild).toHaveClass('row');
  });
  it('between=true emits .row-between (replacing .row)', () => {
    const { container } = render(<Row between>x</Row>);
    expect(container.firstChild).toHaveClass('row-between');
    expect(container.firstChild).not.toHaveClass('row');
  });
});
