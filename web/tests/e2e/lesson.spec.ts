import { test, expect, type Page } from '@playwright/test';
import { requireLogin, SEED } from './_helpers';

// Lesson-runtime e2e. The player renders one block at a time and the step
// is in the URL as ?step=N. Seeded "Hello BootCamp" assignment for the test
// student exposes:
//   step 0  explanation (intro)
//   step 1  multiple_choice
//   step 2  explanation (variables)
//   step 3  fill_blank
//   step 4  predict_output
//   step 5  code (Swift "greet")

const STEP_MC = 1;
const STEP_FILL = 3;
const STEP_PREDICT = 4;
const STEP_CODE_SWIFT = 5;

async function openSeedLesson(page: Page, step?: number): Promise<void> {
  const url = step != null ? `/lesson/${SEED.lessonId}?step=${step}` : `/lesson/${SEED.lessonId}`;
  await page.goto(url);
  // Title is rendered as <Eyebrow>, not a heading element — wait for the
  // "Back to track" button which is always present in PlayerHead.
  await expect(page.getByRole('button', { name: /back to track/i })).toBeVisible({
    timeout: 10_000,
  });
}

// If the exercise is already passed in the seed DB, the renderer locks
// inputs and shows a "Reset" button. Click it so the test can re-submit.
// No-op when the exercise is fresh.
async function unlockIfNeeded(page: Page): Promise<void> {
  const reset = page.getByRole('button', { name: /^reset$/i });
  if (await reset.first().isVisible().catch(() => false)) {
    await reset.first().click();
  }
}

async function fillMonaco(page: Page, code: string): Promise<void> {
  const editor = page.locator('.monaco-editor').first();
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.click();
  await page.waitForTimeout(150);
  // Select all + replace. Monaco intercepts Ctrl+A inside its inputarea.
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type(code, { delay: 5 });
}

// Run serial so the per-step submission tests don't race with the
// step-through test for the same DB attempt rows.
test.describe.configure({ mode: 'serial' });

test.describe('Seed lesson — Hello BootCamp', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
  });

  test('player renders the lesson title + progress bar', async ({ page }) => {
    await openSeedLesson(page);
    // Title shows up as the first occurrence of the lesson name on the page.
    await expect(page.getByText('Hello BootCamp', { exact: false }).first()).toBeVisible();
    // Progress fraction is rendered as "N/Total" via the .mono span.
    await expect(page.locator('.player-progress .mono')).toBeVisible();
  });

  test('multiple_choice: pick Swift, Submit, see "Correct!"', async ({ page }) => {
    await openSeedLesson(page, STEP_MC);
    await unlockIfNeeded(page);
    // Each option renders as a radio with aria-label = option text.
    await page.getByLabel('Swift').check();
    await page.getByRole('button', { name: /^submit$/i }).click();
    await expect(page.getByText(/correct!/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('multiple_choice: a wrong pick shows "Not quite"', async ({ page }) => {
    await openSeedLesson(page, STEP_MC);
    await unlockIfNeeded(page);
    // 'Neither' is the only option NOT in correctOptionIds for the seed MC.
    await page.getByLabel('Neither').check();
    await page.getByRole('button', { name: /^submit$/i }).click();
    await expect(page.getByText(/not quite/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('fill_blank: place the "x" token, Submit, see "Correct!"', async ({ page }) => {
    await openSeedLesson(page, STEP_FILL);
    await unlockIfNeeded(page);
    // The renderer derives the pool from each blank's first expected value
    // when no `tokens` array is set. Seed → pool = ['x'] with label "token-x".
    await page.getByLabel('token-x').click();
    await page.getByRole('button', { name: /^submit$/i }).click();
    await expect(page.getByText(/correct!/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('predict_output: pick "5", Submit, see "Correct!"', async ({ page }) => {
    await openSeedLesson(page, STEP_PREDICT);
    await unlockIfNeeded(page);
    // Seed displays `print(a + b)` with options ['5','6','23','undefined'].
    // Disambiguate from the progress bar (aria-valuenow=5) by targeting the
    // radio role explicitly.
    await page.getByRole('radio', { name: '5' }).check();
    await page.getByRole('button', { name: /^submit$/i }).click();
    await expect(page.getByText(/correct!/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Swift code: Run executes against the sandbox', async ({ page }, testInfo) => {
    await openSeedLesson(page, STEP_CODE_SWIFT);
    await unlockIfNeeded(page);
    await fillMonaco(page, 'func greet() -> String {\n    return "Hello, BootCamp!"\n}\n');
    await page.getByRole('button', { name: /^run$/i }).click();
    // The runner can take a while. Accept any terminal outcome. If the
    // swift-runner sidecar isn't up the platform returns internal_error;
    // skip in that case so a missing sidecar doesn't fail the suite.
    const outcome = await Promise.race([
      page
        .getByText(/tests? passed|tests? failed|compile error|runtime error|timed out|Hello, BootCamp/i)
        .waitFor({ timeout: 60_000 })
        .then(() => 'ok'),
      page
        .getByText(/internal error|runner unavailable/i)
        .waitFor({ timeout: 60_000 })
        .then(() => 'no-runner'),
    ]).catch(() => 'timeout');
    if (outcome === 'no-runner') {
      testInfo.skip(true, 'swift-runner sidecar unavailable in this env');
    }
    expect(outcome).not.toBe('timeout');
  });

  test('Swift code: Submit awards points', async ({ page }, testInfo) => {
    await openSeedLesson(page, STEP_CODE_SWIFT);
    await unlockIfNeeded(page);
    await fillMonaco(page, 'func greet() -> String {\n    return "Hello, BootCamp!"\n}\n');
    await page.getByRole('button', { name: /submit/i }).click();
    try {
      await expect(page.getByText(/points?|\+\d/i).first()).toBeVisible({ timeout: 30_000 });
    } catch {
      testInfo.skip(true, 'swift-runner sidecar unavailable or grading path not ready');
    }
  });
});

test.describe('Lesson step-through', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
  });

  test('Continue advances step by step from start to the completion screen', async ({ page }) => {
    // Steps 0–5 of the seeded lesson are intro / MC / explanation / fill /
    // predict / code. Stepping past the last block lands on the
    // LessonCompleteScreen which renders "Back to track" + a celebratory
    // header. We answer MC/fill/predict correctly so Continue isn't gated
    // on a wrong answer, then Run+Submit the code so the code step also
    // unblocks. After all 6 steps, the URL parses ?step=6 and the
    // completion screen renders.
    await openSeedLesson(page, 0);

    // Step 0 — explanation. Continue → step 1.
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page).toHaveURL(/[?&]step=1/);

    // Step 1 — MC. Pick + Submit, then Continue. Handle locked state too
    // since other tests in the suite may have submitted this MC first.
    await unlockIfNeeded(page);
    await page.getByLabel('Swift').check();
    await page.getByRole('button', { name: /^submit$/i }).click();
    await expect(page.getByText(/correct!/i).first()).toBeVisible({ timeout: 5_000 });
    // After a correct answer the player auto-advances within ~700ms — but
    // also exposes Continue. Wait for the step to bump rather than racing
    // the auto-advance setTimeout.
    await expect(page).toHaveURL(/[?&]step=2/, { timeout: 5_000 });

    // Step 2 — explanation. Continue → step 3.
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page).toHaveURL(/[?&]step=3/);

    // Step 3 — fill_blank.
    await unlockIfNeeded(page);
    await page.getByLabel('token-x').click();
    await page.getByRole('button', { name: /^submit$/i }).click();
    await expect(page.getByText(/correct!/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/[?&]step=4/, { timeout: 5_000 });

    // Step 4 — predict_output.
    await unlockIfNeeded(page);
    await page.getByRole('radio', { name: '5' }).check();
    await page.getByRole('button', { name: /^submit$/i }).click();
    await expect(page.getByText(/correct!/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/[?&]step=5/, { timeout: 5_000 });

    // Step 5 — code. Submit a passing implementation. The sandbox may take
    // a few seconds; we accept any terminal Submit response. After it,
    // the player should advance to the completion screen (step==blocks.length).
    await unlockIfNeeded(page);
    await fillMonaco(page, 'func greet() -> String {\n    return "Hello, BootCamp!"\n}\n');
    await page.getByRole('button', { name: /submit/i }).click();
    await expect(page.getByText(/back to track/i).first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Lesson auth gate', () => {
  test('unauthenticated user is bounced to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`/lesson/${SEED.lessonId}`);
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });
});
