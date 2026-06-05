import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import React from 'react';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) =>
    React.createElement('textarea', {
      'data-testid': 'monaco',
      value,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value),
    }),
  loader: { config: () => {} },
}));

// CodeExercise loads the editor via next/dynamic(() => import('./CodeMonacoEditor'),
// { ssr: false }). That wrapper imports the real monaco-editor ESM (DOM-touching,
// worker setup) which doesn't belong in jsdom — so mock it to the same textarea
// stand-in. Because it's behind next/dynamic, tests that assert on the editor
// must await it via findByTestId rather than getByTestId.
vi.mock('@/components/lesson/renderers/CodeMonacoEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) =>
    React.createElement('textarea', {
      'data-testid': 'monaco',
      value,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value),
    }),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
