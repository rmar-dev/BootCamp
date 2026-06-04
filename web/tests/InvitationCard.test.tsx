import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvitationCard } from '../components/invitations/InvitationCard';

describe('InvitationCard', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('shows the invitee email and the full magic link', () => {
    render(<InvitationCard email="ivy@x.com" name="Ivy" link="https://app/accept-invite?token=abc" expiresAt="2026-06-11T00:00:00.000Z" />);
    expect(screen.getByText('ivy@x.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://app/accept-invite?token=abc')).toBeInTheDocument();
  });

  it('copies the link to the clipboard when Copy is clicked', () => {
    render(<InvitationCard email="ivy@x.com" name="Ivy" link="https://app/accept-invite?token=abc" expiresAt="2026-06-11T00:00:00.000Z" />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://app/accept-invite?token=abc');
  });
});
