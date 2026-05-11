'use client';
import { useState } from 'react';
import type { PredictOutputPayload } from '@/lib/exercise-payloads';
import { PrimaryButton } from '@/components/lesson/renderers/_shared';

type Props = {
  payload: PredictOutputPayload;
  onSubmit: (answer: string) => void | Promise<void>;
  disabled?: boolean;
};

export function ReviewPredictOutput({ payload, onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');

  return (
    <div className="space-y-4">
      <pre className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-900 p-4 font-mono text-sm leading-6 text-gray-100">
        {payload.displayedCode}
      </pre>
      <label className="block">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Predicted output</span>
        <textarea
          aria-label="predicted output"
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm text-gray-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-500 dark:focus:ring-blue-500"
          rows={3}
          value={value}
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
        />
      </label>
      <PrimaryButton onClick={() => onSubmit(value)} disabled={disabled}>
        Submit
      </PrimaryButton>
    </div>
  );
}
