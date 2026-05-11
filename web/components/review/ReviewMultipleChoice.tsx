'use client';
import { useState } from 'react';
import type { MultipleChoicePayload } from '@/lib/exercise-payloads';
import { PrimaryButton } from '@/components/lesson/renderers/_shared';

type Props = {
  payload: MultipleChoicePayload;
  onSubmit: (answer: { selectedOptionIds: string[] }) => void | Promise<void>;
  disabled?: boolean;
};

export function ReviewMultipleChoice({ payload, onSubmit, disabled }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    if (payload.multiSelect) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelected(new Set([id]));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-base font-medium text-gray-900 dark:text-gray-100">
        {payload.questionMarkdown}
      </p>
      <ul className="space-y-2">
        {payload.options.map((opt) => {
          const isSelected = selected.has(opt.id);
          return (
            <li key={opt.id}>
              <label
                className={
                  isSelected
                    ? 'flex cursor-pointer items-center gap-3 rounded-lg border-2 border-blue-500 bg-blue-50 px-4 py-3 transition dark:border-blue-500 dark:bg-blue-950/40'
                    : 'flex cursor-pointer items-center gap-3 rounded-lg border-2 border-gray-200 bg-white px-4 py-3 transition hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700'
                }
              >
                <input
                  type={payload.multiSelect ? 'checkbox' : 'radio'}
                  name="review-mc"
                  checked={isSelected}
                  onChange={() => toggle(opt.id)}
                  disabled={disabled}
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="text-sm text-gray-800 dark:text-gray-200">{opt.text}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <PrimaryButton
        onClick={() => onSubmit({ selectedOptionIds: Array.from(selected) })}
        disabled={selected.size === 0 || disabled}
      >
        Submit
      </PrimaryButton>
    </div>
  );
}
