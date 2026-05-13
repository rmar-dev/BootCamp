import { test, expect, type Page } from '@playwright/test';
import { requireLogin, SEED } from './_helpers';

// Adaptive Content Engine e2e. The seeded "Hello BootCamp" lesson hands the
// test student a 4-exercise assignment (multiple_choice + fill_blank +
// predict_output + code) drawn from a larger pool. These tests exercise
// the UI markers the engine renders:
//   pool-status-chip    — total-pool count next to the lesson title
//   exercise-block      — one wrapper per exercise rendered to the student
//   pool-complete-view  — completion screen variant when every pool
//                         exercise has been attempted
//   fresh-exercises-btn — primary button on the pool-complete screen

const SEED_BLOCKS_TOTAL = 6; // 4 exercises + 2 explanations in the seed lesson
const SEED_EXERCISE_BLOCKS = 4; // mc, fill, predict, code (kotlin filtered out)

async function openSeedLesson(page: Page, step?: number): Promise<void> {
  const url = step != null ? `/lesson/${SEED.lessonId}?step=${step}` : `/lesson/${SEED.lessonId}`;
  await page.goto(url);
  await expect(page.getByRole('button', { name: /back to track/i })).toBeVisible({
    timeout: 10_000,
  });
}

// Click the LockedNotice "Reset" button if the current exercise is already
// passed. No-op when the renderer is in a fresh state. Used inside the
// step-through walk because adaptive-content runs serial within this file
// and an earlier test may have locked one of these exercises.
async function unlockIfNeeded(page: Page): Promise<void> {
  const reset = page.getByRole('button', { name: /^reset$/i });
  if (await reset.first().isVisible().catch(() => false)) {
    await reset.first().click();
  }
}

// Drive the player through every block, submitting a correct answer at each
// exercise step. After the last block, the player lands on either the
// regular lesson-complete screen or the pool-complete variant depending on
// what the assignment service does once every selected exercise has been
// passed.
async function completeAllExercises(page: Page): Promise<void> {
  await openSeedLesson(page, 0);
  // Step 0 — intro explanation
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/[?&]step=1/, { timeout: 5_000 });

  // Step 1 — MC
  await unlockIfNeeded(page);
  await page.getByLabel('Swift').check();
  await page.getByRole('button', { name: /^submit$/i }).click();
  await expect(page).toHaveURL(/[?&]step=2/, { timeout: 5_000 });

  // Step 2 — explanation
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/[?&]step=3/, { timeout: 5_000 });

  // Step 3 — fill_blank
  await unlockIfNeeded(page);
  await page.getByLabel('token-x').click();
  await page.getByRole('button', { name: /^submit$/i }).click();
  await expect(page).toHaveURL(/[?&]step=4/, { timeout: 5_000 });

  // Step 4 — predict_output
  await unlockIfNeeded(page);
  await page.getByRole('radio', { name: '5' }).check();
  await page.getByRole('button', { name: /^submit$/i }).click();
  await expect(page).toHaveURL(/[?&]step=5/, { timeout: 5_000 });

  // Step 5 — code. Submit a passing implementation. The auto-advance only
  // fires for non-last blocks (see LessonPlayerShell.onAttempt), so we
  // wait for the sandbox response then click the Next-style button in
  // PlayerFoot to land on step=6 (the completion screen).
  await unlockIfNeeded(page);
  const editor = page.locator('.monaco-editor').first();
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type(
    'func greet() -> String {\n    return "Hello, BootCamp!"\n}\n',
    { delay: 5 },
  );
  await page.getByRole('button', { name: /submit/i }).click();
  // Wait for the sandbox response, then nudge to the completion screen.
  // We don't depend on the response text — the next-step button in the
  // footer becomes enabled once the submit resolves.
  const finishBtn = page.getByRole('button', { name: /finish lesson|^next$/i }).last();
  await finishBtn.waitFor({ state: 'visible', timeout: 30_000 });
  await finishBtn.click();
}

// The 6-block step-through races for the same DB state as the lesson spec.
// Pin to serial within this file so the adaptive-content scenarios don't
// trip over each other.
test.describe.configure({ mode: 'serial' });

test.describe('Adaptive Content Engine', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
  });

  test('four_week student sees pool-status chip and 4 exercise blocks', async ({ page }) => {
    await openSeedLesson(page, 0);
    // The chip is in the PlayerHead. data-pool-total mirrors the visible
    // text so the assertion stays stable if we later restyle the badge.
    const chip = page.locator('[data-testid="pool-status-chip"]');
    await expect(chip).toBeVisible();
    expect(await chip.getAttribute('data-pool-total')).toBe(String(SEED_BLOCKS_TOTAL));

    // Walk every step and assert the visible step's exercise-block count
    // (the player renders one block at a time). After visiting all steps,
    // the cumulative count of distinct exercise IDs we saw is 4.
    const seenExerciseIds = new Set<string>();
    for (let i = 0; i < SEED_BLOCKS_TOTAL; i += 1) {
      await openSeedLesson(page, i);
      const blocks = page.locator('[data-testid="exercise-block"]');
      const count = await blocks.count();
      if (count > 0) {
        const id = await blocks.first().getAttribute('data-exercise-id');
        if (id) seenExerciseIds.add(id);
      }
    }
    expect(seenExerciseIds.size).toBe(SEED_EXERCISE_BLOCKS);
  });

  test('completing every exercise lands on the lesson-complete screen', async ({ page }) => {
    await completeAllExercises(page);
    // The completion screen renders one of two variants. Either is fine —
    // both prove the player advanced past the last block AND the assignment
    // service responded to the final submit.
    const completeView = page.locator(
      '[data-testid="lesson-complete-view"], [data-testid="pool-complete-view"]',
    );
    await expect(completeView.first()).toBeVisible({ timeout: 30_000 });
  });

  test('Fresh exercises button — only on pool-complete variant', async ({ page }) => {
    await completeAllExercises(page);
    // Whether the assignment service returns pool_complete depends on
    // whether the pool has more exercises to draw. The seed pool has one
    // unselected exercise (fix_bug — filtered out of the initial 4 by the
    // cohort gate), so the engine MAY rotate it in instead of declaring
    // pool_complete. We don't lock that decision — we just assert that
    // when the pool-complete variant DOES show, the Fresh exercises button
    // is present and clickable.
    const pool = page.locator('[data-testid="pool-complete-view"]');
    if (await pool.count() === 0) {
      test.skip(
        true,
        'assignment service rotated in a fresh exercise instead of pool_complete; covered by the engine unit tests',
      );
    }
    const freshBtn = page.locator('[data-testid="fresh-exercises-btn"]');
    await expect(freshBtn).toBeVisible();
    // Click it. The handler hits POST /api/lessons/<id>/revisit which
    // generates a new assignment. On success the router.refresh()s and the
    // screen flips back to the regular block view.
    await freshBtn.click();
    await page.waitForLoadState('networkidle');
  });
});
