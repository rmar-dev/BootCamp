import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkillsList } from '@/components/profile/SkillsList';

describe('SkillsList', () => {
  it('renders one row per skill with correct % and name', () => {
    const skills = [
      { trackId: 't-1', title: 'Swift Fundamentals', language: 'swift' as const, progressPct: 80 },
      { trackId: 't-2', title: 'Kotlin Fundamentals', language: 'kotlin' as const, progressPct: 40 },
    ];
    render(<SkillsList skills={skills} />);
    expect(screen.getByText('Swift Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Kotlin Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('uses iris background for swift bars and amber for kotlin', () => {
    const skills = [
      { trackId: 't-1', title: 'Swift', language: 'swift' as const, progressPct: 50 },
      { trackId: 't-2', title: 'Kotlin', language: 'kotlin' as const, progressPct: 50 },
    ];
    const { container } = render(<SkillsList skills={skills} />);
    const fills = container.querySelectorAll('.bar-fill');
    expect(fills[0].getAttribute('style')).toContain('iris');
    expect(fills[1].getAttribute('style')).toContain('amber');
  });

  it('renders empty state when no skills', () => {
    render(<SkillsList skills={[]} />);
    expect(screen.getByText(/no tracks/i)).toBeInTheDocument();
  });
});
