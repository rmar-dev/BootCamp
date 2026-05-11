import { parseSubmissionPayload } from '../../src/content/validators/submission-payload.validator';

describe('parseSubmissionPayload', () => {
  it('parses a code submission', () => {
    const result = parseSubmissionPayload('code', {
      type: 'code',
      code: 'let x = 1',
    });
    expect(result.type).toBe('code');
  });

  it('parses a fix_bug submission', () => {
    const result = parseSubmissionPayload('fix_bug', {
      type: 'fix_bug',
      code: 'let x = 1',
    });
    expect(result.type).toBe('fix_bug');
  });

  it('parses a fill_blank submission', () => {
    const result = parseSubmissionPayload('fill_blank', {
      type: 'fill_blank',
      blanks: { blank_1: 'foo' },
    });
    expect(result.type).toBe('fill_blank');
  });

  it('parses a predict_output submission', () => {
    const result = parseSubmissionPayload('predict_output', {
      type: 'predict_output',
      answer: '42',
    });
    expect(result.type).toBe('predict_output');
  });

  it('parses a multiple_choice submission', () => {
    const result = parseSubmissionPayload('multiple_choice', {
      type: 'multiple_choice',
      selectedOptionIds: ['a', 'b'],
    });
    expect(result.type).toBe('multiple_choice');
  });

  it('rejects a submission with mismatched type discriminator', () => {
    expect(() =>
      parseSubmissionPayload('code', { type: 'fix_bug', code: 'x' }),
    ).toThrow();
  });

  it('rejects a code submission missing the code field', () => {
    expect(() => parseSubmissionPayload('code', { type: 'code' })).toThrow();
  });
});
