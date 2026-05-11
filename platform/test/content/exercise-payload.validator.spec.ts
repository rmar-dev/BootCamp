import { parseExercisePayload } from '../../src/content/validators/exercise-payload.validator';

describe('parseExercisePayload', () => {
  describe('code', () => {
    it('parses a valid code payload', () => {
      const raw = {
        type: 'code',
        language: 'swift',
        starterCode: 'func hello() {}',
        testCode: 'assert(hello() == nil)',
        testEntryPoint: 'runTests',
      };
      const result = parseExercisePayload('code', raw);
      expect(result.type).toBe('code');
      if (result.type === 'code') {
        expect(result.language).toBe('swift');
      }
    });

    it('rejects a code payload with the wrong type discriminator', () => {
      const raw = {
        type: 'fix_bug',
        language: 'swift',
        starterCode: '',
        testCode: '',
        testEntryPoint: 'runTests',
      };
      expect(() => parseExercisePayload('code', raw)).toThrow();
    });

    it('rejects a code payload missing testEntryPoint', () => {
      const raw = {
        type: 'code',
        language: 'swift',
        starterCode: '',
        testCode: '',
      };
      expect(() => parseExercisePayload('code', raw)).toThrow();
    });
  });

  describe('multiple_choice', () => {
    it('parses a valid multiple choice payload', () => {
      const raw = {
        type: 'multiple_choice',
        questionMarkdown: 'What is 2+2?',
        options: [
          { id: 'a', text: '3' },
          { id: 'b', text: '4' },
        ],
        correctOptionIds: ['b'],
        multiSelect: false,
      };
      const result = parseExercisePayload('multiple_choice', raw);
      expect(result.type).toBe('multiple_choice');
      if (result.type === 'multiple_choice') {
        expect(result.correctOptionIds).toEqual(['b']);
      }
    });

    it('rejects a multiple choice payload whose correctOptionIds reference unknown options', () => {
      const raw = {
        type: 'multiple_choice',
        questionMarkdown: 'q',
        options: [{ id: 'a', text: '3' }],
        correctOptionIds: ['z'],
        multiSelect: false,
      };
      expect(() => parseExercisePayload('multiple_choice', raw)).toThrow(
        /correctOptionIds/,
      );
    });
  });

  describe('fill_blank', () => {
    it('parses a valid fill_blank payload', () => {
      const raw = {
        type: 'fill_blank',
        language: 'kotlin',
        template: 'val x = ___',
        blanks: [{ id: 'blank_1', expected: ['1', '1L'] }],
      };
      const result = parseExercisePayload('fill_blank', raw);
      expect(result.type).toBe('fill_blank');
    });

    it('rejects fill_blank with no blanks', () => {
      const raw = {
        type: 'fill_blank',
        language: 'kotlin',
        template: 'no blanks here',
        blanks: [],
      };
      expect(() => parseExercisePayload('fill_blank', raw)).toThrow();
    });

    it('parses a fill_blank payload with an authored token pool', () => {
      const raw = {
        type: 'fill_blank',
        language: 'swift',
        template: 'let ___1___ = 42',
        blanks: [{ id: '1', expected: ['x'] }],
        tokens: ['x', 'y', 'var', 'let'],
      };
      const result = parseExercisePayload('fill_blank', raw) as {
        type: 'fill_blank';
        tokens?: string[];
      };
      expect(result.type).toBe('fill_blank');
      expect(result.tokens).toEqual(['x', 'y', 'var', 'let']);
    });

    it('rejects fill_blank with an empty tokens array', () => {
      const raw = {
        type: 'fill_blank',
        language: 'swift',
        template: 'let ___1___ = 42',
        blanks: [{ id: '1', expected: ['x'] }],
        tokens: [],
      };
      expect(() => parseExercisePayload('fill_blank', raw)).toThrow();
    });

    it('rejects fill_blank when tokens contains an empty string', () => {
      const raw = {
        type: 'fill_blank',
        language: 'swift',
        template: 'let ___1___ = 42',
        blanks: [{ id: '1', expected: ['x'] }],
        tokens: ['x', ''],
      };
      expect(() => parseExercisePayload('fill_blank', raw)).toThrow();
    });
  });

  describe('visual_playground', () => {
    function buttonRaw(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
      return {
        type: 'visual_playground',
        language: 'swift',
        primitive: 'button',
        controls: [
          { kind: 'text', id: 'label', label: 'Label', default: 'Tap me' },
          {
            kind: 'color', id: 'backgroundColor', label: 'Background', default: 'amber',
            options: [
              { id: 'peacock', cssColor: '#0aa6c4', codeRef: 'peacock' },
              { id: 'amber',   cssColor: '#ffae3d', codeRef: 'amber'   },
            ],
          },
          { kind: 'slider', id: 'cornerRadius', label: 'Corner radius', min: 0, max: 40, default: 21 },
          { kind: 'toggle', id: 'shadow', label: 'Shadow', default: true },
        ],
        ...overrides,
      };
    }

    it('parses a valid button playground payload', () => {
      const result = parseExercisePayload('visual_playground', buttonRaw()) as { type: string };
      expect(result.type).toBe('visual_playground');
    });

    it('rejects when controls is empty', () => {
      expect(() => parseExercisePayload('visual_playground', buttonRaw({ controls: [] }))).toThrow();
    });

    it('rejects when a slider default is outside [min, max]', () => {
      const raw = buttonRaw({
        controls: [
          { kind: 'slider', id: 's', label: 'S', min: 0, max: 10, default: 99 },
        ],
      });
      expect(() => parseExercisePayload('visual_playground', raw)).toThrow(/out of range/);
    });

    it('rejects when a color default references an unknown option id', () => {
      const raw = buttonRaw({
        controls: [
          {
            kind: 'color', id: 'bg', label: 'BG', default: 'mystery',
            options: [
              { id: 'peacock', cssColor: '#0aa6c4', codeRef: 'peacock' },
              { id: 'amber',   cssColor: '#ffae3d', codeRef: 'amber'   },
            ],
          },
        ],
      });
      expect(() => parseExercisePayload('visual_playground', raw)).toThrow(/unknown option id/);
    });

    it('rejects when a color control has fewer than 2 options', () => {
      const raw = buttonRaw({
        controls: [
          {
            kind: 'color', id: 'bg', label: 'BG', default: 'p',
            options: [{ id: 'p', cssColor: '#fff', codeRef: 'p' }],
          },
        ],
      });
      expect(() => parseExercisePayload('visual_playground', raw)).toThrow();
    });

    it('rejects when an unsupported primitive is used', () => {
      expect(() =>
        parseExercisePayload('visual_playground', buttonRaw({ primitive: 'card' as unknown as 'button' })),
      ).toThrow();
    });
  });

  describe('predict_output', () => {
    it('parses a valid predict_output payload', () => {
      const raw = {
        type: 'predict_output',
        displayedCode: 'print(1+1)',
        displayedLanguage: 'swift',
        expectedOutput: '2',
      };
      const result = parseExercisePayload('predict_output', raw);
      expect(result.type).toBe('predict_output');
    });
  });

  describe('fix_bug', () => {
    it('parses a valid fix_bug payload', () => {
      const raw = {
        type: 'fix_bug',
        language: 'swift',
        brokenCode: 'let x = ',
        testCode: 'assert(x == 1)',
        testEntryPoint: 'runTests',
      };
      const result = parseExercisePayload('fix_bug', raw);
      expect(result.type).toBe('fix_bug');
    });
  });
});
