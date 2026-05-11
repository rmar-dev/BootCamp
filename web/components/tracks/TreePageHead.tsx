'use client';
import { cn } from '@/components/ui/cn';

const LANGUAGE_BADGE_TINT: Record<string, string> = {
  swift: 'badge-iris',
  kotlin: 'badge-amber',
};

function languageDisplayName(language: string): string {
  if (language === 'swift') return 'Swift';
  if (language === 'kotlin') return 'Kotlin';
  return language.charAt(0).toUpperCase() + language.slice(1);
}

export type TreePageHeadProps = {
  language: string;
  totalLessons: number;
  completedLessons: number;
};

export function TreePageHead({ language, totalLessons, completedLessons }: TreePageHeadProps) {
  const langName = languageDisplayName(language);
  const langBadgeTint = LANGUAGE_BADGE_TINT[language];
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Skill tree · {langName} track
        </div>
        <h1 className="h-display">Your path forward.</h1>
        <p className="muted" style={{ marginTop: 8, fontSize: 'var(--t-lg)' }}>
          Sections unlock as you master the previous one. Tap any node to begin.
        </p>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span className={cn('badge', langBadgeTint)}>
          <span className="badge-dot" />
          {langName}
        </span>
        <span className="badge">
          <span className="badge-dot" />
          {completedLessons} of {totalLessons} lessons
        </span>
      </div>
    </div>
  );
}
