import { serverCheck } from '../../src/submission/server-check';
import {
  MultipleChoicePayload,
  FillBlankPayload,
  PredictOutputPayload,
  CodePayload,
} from '../../src/content/types/exercise-payload.types';

const mcPayload: MultipleChoicePayload = {
  type: 'multiple_choice',
  questionMarkdown: 'Which?',
  options: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
    { id: 'c', text: 'C' },
  ],
  correctOptionIds: ['a', 'c'],
  multiSelect: true,
};

const fillPayload: FillBlankPayload = {
  type: 'fill_blank',
  language: 'swift',
  template: 'let x = ___',
  blanks: [{ id: 'b1', expected: ['Int', 'int'] }],
};

const predictPayload: PredictOutputPayload = {
  type: 'predict_output',
  displayedCode: 'print("hello")',
  displayedLanguage: 'swift',
  expectedOutput: 'hello',
};

const codePayload: CodePayload = {
  type: 'code',
  language: 'swift',
  starterCode: '',
  testCode: '',
  testEntryPoint: 'runTests',
};

describe('serverCheck', () => {
  it('MC: returns passed=true when answer matches correctOptionIds (order-independent)', () => {
    const result = serverCheck(mcPayload, ['c', 'a']);
    expect(result.passed).toBe(true);
  });

  it('MC: returns passed=false when answer does not match correctOptionIds', () => {
    const result = serverCheck(mcPayload, ['a', 'b']);
    expect(result.passed).toBe(false);
  });

  it('fill_blank: returns passed=true after trimming whitespace', () => {
    const result = serverCheck(fillPayload, { b1: '  Int  ' });
    expect(result.passed).toBe(true);
  });

  it('predict_output: returns passed=true when trimmed answer matches', () => {
    const result = serverCheck(predictPayload, '  hello  ');
    expect(result.passed).toBe(true);
  });

  it('code: throws error since serverCheck does not handle execution types', () => {
    expect(() => serverCheck(codePayload, 'some code')).toThrow(
      'serverCheck does not handle execution types',
    );
  });
});
