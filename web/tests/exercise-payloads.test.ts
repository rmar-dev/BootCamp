import { describe, it, expect } from 'vitest';
import { lessonSchema } from '@/lib/exercise-payloads.zod';

describe('lessonSchema', () => {
  it('parses a minimal lesson', () => {
    const ok = lessonSchema.safeParse({
      id: 'a', version: 1, title: 't', trackId: null, blocks: [],
    });
    expect(ok.success).toBe(true);
  });

  it('parses each exercise type', () => {
    const ok = lessonSchema.safeParse({
      id: 'a', version: 1, title: 't', trackId: null,
      blocks: [
        { kind: 'explanation', id: 'b1', markdown: 'hi' },
        {
          kind: 'exercise', id: 'b2',
          exercise: {
            id: 'e1', version: 1, type: 'multiple_choice',
            promptMarkdown: 'p', pointsMax: 100,
            payload: {
              type: 'multiple_choice', questionMarkdown: 'q?',
              options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
              correctOptionIds: ['a'], multiSelect: false,
            },
            attemptStatus: 'unattempted',
          },
        },
      ],
    });
    expect(ok.success).toBe(true);
  });
});
