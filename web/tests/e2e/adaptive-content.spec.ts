import { test, expect } from '@playwright/test';

// TODO (infra blockers before these can be wired up):
//   1. A seed utility that inserts a lesson with 8 published exercises into
//      the platform DB and exposes the lessonId at test time.
//   2. A fixture (or global-setup step) that creates a student in a
//      `four_week` cohort and sets a valid JWT cookie/localStorage token on
//      the Playwright browser context — the existing tests (lesson.spec.ts)
//      do not have this; they either hit public pages or do inline register
//      flows, neither of which works here because adaptive content is
//      cohort-gated.
//   3. A helper to mark a set of exercise attempts as "attempted" for a given
//      student so the "Fresh exercises" rotation and pool-complete paths can
//      be exercised.
//
// Convention for test IDs expected in the UI (to be added when wiring):
//   data-testid="pool-status-chip"   — shows pool size / cohort info
//   data-testid="exercise-block"     — one per exercise rendered in the lesson
//   data-testid="fresh-exercises-btn" — button that rotates to unseen exercises

test.describe('Adaptive Content Engine', () => {
  test.fixme(
    'four_week student sees pool-status chip and 4 exercises',
    async ({ page }) => {
      // TODO: Wire up seed + auth fixture (see blockers above), then:
      //
      //   const lessonId = await seedLessonWith8Exercises(); // from fixture
      //   await loginAsStudent(page, { cohort: 'four_week' }); // from fixture
      //
      //   await page.goto(`/lesson/${lessonId}`);
      //   await expect(page.getByTestId('pool-status-chip')).toBeVisible();
      //   const exerciseBlocks = page.locator('[data-testid="exercise-block"]');
      //   await expect(exerciseBlocks).toHaveCount(4);
    },
  );

  test.fixme(
    'Fresh exercises button rotates to new exercises',
    async ({ page }) => {
      // TODO: Same seed + auth fixture as above.
      // After initial load, mark all 4 selected exercises as attempted, then:
      //
      //   const initialIds = await page
      //     .locator('[data-testid="exercise-block"]')
      //     .evaluateAll(els => els.map(el => el.dataset.exerciseId));
      //
      //   await page.getByTestId('fresh-exercises-btn').click();
      //   await page.waitForLoadState('networkidle');
      //
      //   const newIds = await page
      //     .locator('[data-testid="exercise-block"]')
      //     .evaluateAll(els => els.map(el => el.dataset.exerciseId));
      //
      //   expect(newIds).not.toEqual(initialIds);
    },
  );

  test.fixme(
    'pool-complete state shows full list of 8 exercises',
    async ({ page }) => {
      // TODO: Fixture that seeds all 8 pool exercises as attempted for the
      // student before navigating. Then:
      //
      //   await page.goto(`/lesson/${lessonId}`);
      //   // PoolCompleteView should render instead of the normal exercise list
      //   await expect(page.getByTestId('pool-complete-view')).toBeVisible();
      //   const exerciseItems = page.locator('[data-testid="exercise-block"]');
      //   await expect(exerciseItems).toHaveCount(8);
    },
  );
});
