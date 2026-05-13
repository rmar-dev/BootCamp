import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Playwright globalSetup. Runs once before any test. Re-seeds the platform
// DB so the test student's attempt history is cleared — without this the
// MC / fill_blank / predict_output specs would only pass on the FIRST run
// after a fresh seed (subsequent runs see the exercise as locked and the
// renderer refuses to re-submit).
//
// We skip when the platform repo isn't present (e.g. running web tests in
// isolation against a remote backend); the suite's _helpers.ts then degrades
// to skip-on-infra-down for anything that needed login.

export default async function globalSetup(): Promise<void> {
  const platformDir = join(__dirname, '..', '..', '..', 'platform');
  if (!existsSync(join(platformDir, 'prisma', 'seed.ts'))) {
    console.warn('[e2e] platform repo not at expected path — skipping re-seed');
    return;
  }

  // npm run seed is idempotent (seed.ts uses upsert) AND clears the test
  // student's Attempt + ExerciseResult + LessonAssignment rows up front.
  const result = spawnSync('npm', ['run', 'seed'], {
    cwd: platformDir,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    console.warn(`[e2e] seed exited with status ${result.status} — tests may skip`);
  }
}
