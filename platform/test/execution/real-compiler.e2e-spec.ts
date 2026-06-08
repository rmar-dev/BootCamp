// eslint-disable-next-line @typescript-eslint/no-var-requires
const Docker = require('dockerode');
import { DockerRunner } from '../../src/execution/docker-runner';
import { buildHarness } from '../../src/execution/harness';

const ENABLED = process.env.RUN_EXECUTION_E2E === '1';
const maybeDescribe = ENABLED ? describe : describe.skip;

maybeDescribe('real-compiler e2e', () => {
  let runner: DockerRunner;

  beforeAll(() => {
    runner = new DockerRunner(new Docker());
  });

  it('swift: prints hello and exits 0', async () => {
    const result = await runner.run('swift', 'print("hello from swift")', 15_000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello from swift');
  }, 30_000);

  it('swift: reports compile error with exit 10', async () => {
    const result = await runner.run('swift', 'let x =', 15_000);
    expect(result.exitCode).toBe(10);
    expect(result.stderr.length).toBeGreaterThan(0);
  }, 30_000);

  it('swift: a stray `import SwiftUI` on pure-logic code still runs and grades by output', async () => {
    // Before the fix this aborted at "no such module 'SwiftUI'" (exit 10).
    // The harness strips the unavailable import so the real logic executes.
    const student = 'import SwiftUI\nfunc greet() -> String { return "hello" }';
    const test = 'bootcampAssertEqual(greet(), "hello")\nprint("✅ ok")';
    const result = await runner.run('swift', buildHarness('swift', student, test), 15_000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✅ ok');
    expect(result.stderr).not.toContain('no such module');
  }, 30_000);

  it('kotlin: prints hello and exits 0', async () => {
    const result = await runner.run(
      'kotlin',
      'fun main() { println("hello from kotlin") }',
      20_000,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello from kotlin');
  }, 60_000);

  it('kotlin: reports compile error with exit 10', async () => {
    const result = await runner.run('kotlin', 'fun main() { val x = }', 20_000);
    expect(result.exitCode).toBe(10);
    expect(result.stderr.length).toBeGreaterThan(0);
  }, 60_000);
});
