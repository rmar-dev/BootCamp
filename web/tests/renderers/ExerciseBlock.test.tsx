import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExerciseBlock } from '@/components/lesson/ExerciseBlock';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

function make(type: ExerciseDTO['type']): ExerciseDTO {
  const base = { id: 'e', version: 1, type, promptMarkdown: 'p', pointsMax: 100, attemptStatus: 'unattempted' as const };
  switch (type) {
    case 'multiple_choice':
      return { ...base, payload: {
        type: 'multiple_choice', questionMarkdown: 'q?',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
        correctOptionIds: ['a'], multiSelect: false,
      } };
    case 'fill_blank':
      return { ...base, payload: {
        type: 'fill_blank', language: 'swift', template: 'x = {{n}}',
        blanks: [{ id: 'n', expected: ['1'] }],
      } };
    case 'predict_output':
      return { ...base, payload: {
        type: 'predict_output', displayedLanguage: 'swift',
        displayedCode: 'print(1)', expectedOutput: '1',
      } };
    case 'code':
      return { ...base, payload: {
        type: 'code', language: 'swift', starterCode: 's',
        testCode: '', testEntryPoint: 'f',
      } };
    case 'fix_bug':
      return { ...base, payload: {
        type: 'fix_bug', language: 'swift', brokenCode: 'b',
        testCode: '', testEntryPoint: 'f',
      } };
    case 'capstone_submission':
      return { ...base, payload: { type: 'capstone_submission' } };
    case 'visual_playground':
      return { ...base, payload: {
        type: 'visual_playground', language: 'swift', primitive: 'button',
        controls: [
          { kind: 'text', id: 'label', label: 'Label', default: 'Tap me' },
          { kind: 'color', id: 'bg', label: 'BG', default: 'p',
            options: [
              { id: 'p', cssColor: '#0aa6c4', codeRef: 'peacock' },
              { id: 'i', cssColor: '#f25cb6', codeRef: 'iris' },
            ],
          },
        ],
      } };
  }
}

describe('ExerciseBlock', () => {
  it('renders the matching renderer for each type', () => {
    const types: ExerciseDTO['type'][] = [
      'multiple_choice', 'fill_blank', 'predict_output', 'code', 'fix_bug',
    ];
    for (const t of types) {
      const { unmount } = render(<ExerciseBlock exercise={make(t)} />);
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
      unmount();
    }
  });
});
