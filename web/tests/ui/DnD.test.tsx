import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DnDSlot } from '@/components/ui/DnDSlot';
import { DnDToken } from '@/components/ui/DnDToken';

describe('DnDSlot', () => {
  it('emits .dnd-slot, adds .filled when filled prop set', () => {
    const { container } = render(<DnDSlot filled>x</DnDSlot>);
    expect(container.firstChild).toHaveClass('dnd-slot', 'filled');
  });
  it('tint adds .swift / .kotlin', () => {
    const { container, rerender } = render(<DnDSlot tint="swift">x</DnDSlot>);
    expect(container.firstChild).toHaveClass('swift');
    rerender(<DnDSlot tint="kotlin">x</DnDSlot>);
    expect(container.firstChild).toHaveClass('kotlin');
  });
});

describe('DnDToken', () => {
  it('emits .dnd-token, adds .used when used prop set', () => {
    const { container } = render(<DnDToken used>x</DnDToken>);
    expect(container.firstChild).toHaveClass('dnd-token', 'used');
  });
});
