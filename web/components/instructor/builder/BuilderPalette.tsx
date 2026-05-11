'use client';
import type { ExerciseTypeValue } from '@/lib/exercise-payloads';
import { Icon, type IconName } from '@/components/ui';

export type PaletteKind =
  | { kind: 'explanation' }
  | { kind: 'video' }
  | { kind: 'exercise'; type: ExerciseTypeValue };

interface Tile {
  key: string;
  title: string;
  desc: string;
  icon: IconName;
  payload: PaletteKind;
}

const TILES: Tile[] = [
  { key: 'explanation', title: 'Explanation', desc: 'Markdown prose', icon: 'text', payload: { kind: 'explanation' } },
  { key: 'video',       title: 'Video',       desc: 'YouTube / Vimeo / Loom', icon: 'video', payload: { kind: 'video' } },
  { key: 'code',        title: 'Live code',   desc: 'Code editor + run/test', icon: 'code', payload: { kind: 'exercise', type: 'code' } },
  { key: 'fix_bug',     title: 'Fix the bug', desc: 'Broken code to repair',  icon: 'code', payload: { kind: 'exercise', type: 'fix_bug' } },
  { key: 'fill_blank',  title: 'Fill the blanks', desc: 'Drag tokens into slots', icon: 'puzzle', payload: { kind: 'exercise', type: 'fill_blank' } },
  { key: 'predict_output', title: 'Predict output', desc: 'Read code, type stdout', icon: 'eye', payload: { kind: 'exercise', type: 'predict_output' } },
  { key: 'multiple_choice', title: 'Multiple choice', desc: 'One or many correct', icon: 'check', payload: { kind: 'exercise', type: 'multiple_choice' } },
  { key: 'visual_playground', title: 'Visual playground', desc: 'Live preview + code', icon: 'star', payload: { kind: 'exercise', type: 'visual_playground' } },
  { key: 'capstone_submission', title: 'Capstone submission', desc: 'Instructor-graded', icon: 'trophy', payload: { kind: 'exercise', type: 'capstone_submission' } },
];

interface Props {
  onAdd: (payload: PaletteKind) => void;
}

export function BuilderPalette({ onAdd }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {TILES.map((t) => (
        <button key={t.key} type="button" className="palette-tile" onClick={() => onAdd(t.payload)}>
          <span className="palette-tile-icon" aria-hidden>
            <Icon name={t.icon} size={14} />
          </span>
          <span className="palette-tile-body">
            <span className="palette-tile-title">{t.title}</span>
            <span className="palette-tile-desc">{t.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
