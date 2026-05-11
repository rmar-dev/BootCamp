'use client';
import type { LessonDraft, Level } from '@/lib/builder';
import { Field, Input, Select, Textarea } from '@/components/ui';

interface Props {
  draft: LessonDraft;
  onChange: (patch: Partial<LessonDraft>) => void;
}

const LEVELS: { value: Level; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export function BuilderMetaForm({ draft, onChange }: Props) {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 200px 200px',
        gap: 12,
        alignItems: 'start',
      }}
    >
      <Field label="Title" htmlFor="lesson-title">
        <Input
          id="lesson-title"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="What does @State actually do?"
        />
      </Field>
      <Field label="Slug" htmlFor="lesson-slug" help="lowercase, hyphens">
        <Input
          id="lesson-slug"
          value={draft.slug}
          onChange={(e) => onChange({ slug: e.target.value })}
          placeholder="state-in-swiftui"
        />
      </Field>
      <Field label="Level" htmlFor="lesson-level">
        <Select
          id="lesson-level"
          value={draft.level}
          options={LEVELS}
          onChange={(e) => onChange({ level: e.target.value as Level })}
        />
      </Field>
      <Field
        label="Summary"
        htmlFor="lesson-summary"
        style={{ gridColumn: '1 / -1' }}
      >
        <Textarea
          id="lesson-summary"
          value={draft.summary}
          onChange={(e) => onChange({ summary: e.target.value })}
          placeholder="One sentence — the takeaway a student should walk away with."
          rows={2}
          style={{ minHeight: 56 }}
        />
      </Field>
    </section>
  );
}
