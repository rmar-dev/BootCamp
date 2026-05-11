import { LessonInsightService, ExerciseLike } from '../../src/content/services/lesson-insight.service';

const ex = (type: ExerciseLike['type']): ExerciseLike => ({ type });

describe('LessonInsightService', () => {
  const svc = new LessonInsightService();

  describe('estimateMinutes', () => {
    it('returns 1 minute for empty input', () => {
      expect(svc.estimateMinutes([])).toBe(1);
    });
    it('per-type seconds → ceil minutes', () => {
      expect(svc.estimateMinutes([ex('multiple_choice')])).toBe(1);   // 30s → 1
      expect(svc.estimateMinutes([ex('fill_blank')])).toBe(1);        // 60s → 1
      expect(svc.estimateMinutes([ex('predict_output')])).toBe(2);    // 90s → 2
      expect(svc.estimateMinutes([ex('code')])).toBe(4);              // 240s → 4
      expect(svc.estimateMinutes([ex('fix_bug')])).toBe(4);
      expect(svc.estimateMinutes([ex('capstone_submission')])).toBe(20);
    });
    it('sums and ceils mixed lessons', () => {
      // 30 + 60 + 240 = 330s = 5.5 → 6 min
      const lesson = [ex('multiple_choice'), ex('fill_blank'), ex('code')];
      expect(svc.estimateMinutes(lesson)).toBe(6);
    });
  });

  describe('deriveTypeLabel', () => {
    it('empty → Concept + quiz (degenerate default)', () => {
      expect(svc.deriveTypeLabel([])).toBe('Concept + quiz');
    });
    it('only quiz/predict → Concept + quiz', () => {
      expect(svc.deriveTypeLabel([ex('multiple_choice'), ex('predict_output')])).toBe('Concept + quiz');
    });
    it('only code/fix-bug → Code + tests', () => {
      expect(svc.deriveTypeLabel([ex('code'), ex('fix_bug')])).toBe('Code + tests');
    });
    it('mixed quiz + code → Concept + code', () => {
      expect(svc.deriveTypeLabel([ex('multiple_choice'), ex('code')])).toBe('Concept + code');
    });
    it('any capstone present → Capstone', () => {
      expect(svc.deriveTypeLabel([ex('multiple_choice'), ex('capstone_submission')])).toBe('Capstone');
    });
    it('fill_blank groups with quiz side', () => {
      expect(svc.deriveTypeLabel([ex('fill_blank')])).toBe('Concept + quiz');
      expect(svc.deriveTypeLabel([ex('fill_blank'), ex('code')])).toBe('Concept + code');
    });
  });
});
