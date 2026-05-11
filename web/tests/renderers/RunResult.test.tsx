import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RunResult } from '@/components/lesson/renderers/RunResult';
import type { RunResponse } from '@/lib/run';

function result(overrides: Partial<RunResponse>): RunResponse {
  return {
    outcome: 'passed', passed: true, stdout: '', stderr: '',
    durationMs: 0, timedOut: false, ...overrides,
  };
}

describe('RunResult', () => {
  it('renders nothing when null', () => {
    const { container } = render(<RunResult result={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders passed', () => {
    render(<RunResult result={result({ outcome: 'passed', stdout: 'ok' })} />);
    expect(screen.getByText(/tests passed/i)).toBeInTheDocument();
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('renders failed', () => {
    render(<RunResult result={result({ outcome: 'failed', passed: false, stderr: 'assertion failed' })} />);
    expect(screen.getByText(/tests failed/i)).toBeInTheDocument();
    expect(screen.getByText(/assertion failed/i)).toBeInTheDocument();
  });

  it('renders compile_error', () => {
    render(<RunResult result={result({ outcome: 'compile_error', passed: false, stderr: 'error: expected' })} />);
    expect(screen.getByText(/compile error/i)).toBeInTheDocument();
    expect(screen.getByText(/error: expected/i)).toBeInTheDocument();
  });

  it('renders timed_out', () => {
    render(<RunResult result={result({ outcome: 'timed_out', passed: false, timedOut: true })} />);
    expect(screen.getByText(/timed out/i)).toBeInTheDocument();
  });

  it('renders internal_error', () => {
    render(<RunResult result={result({ outcome: 'internal_error', passed: false, stderr: 'sidecar down' })} />);
    expect(screen.getByText(/execution service/i)).toBeInTheDocument();
    expect(screen.getByText(/sidecar down/i)).toBeInTheDocument();
  });
});
