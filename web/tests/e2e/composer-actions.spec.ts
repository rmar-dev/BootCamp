import { test, expect } from '@playwright/test';
import { requireLogin } from './_helpers';

// Secondary actions on /instructor/skill-tree. The base spec covers
// "Save as new tree" + the per-student override round-trip. This file
// covers the rest of the composer toolbar so a regression in one of
// these doesn't slip past:
//   - Toggle visibility (private ↔ public)
//   - Activate on cohort + clear assignment
//   - Delete tree
//   - Swap a lesson via the SwapLessonModal

test.describe.configure({ mode: 'serial' });

const UNIQUE = String(Date.now());
const TREE_VIS = `vis-toggle-${UNIQUE}`;
const TREE_ACTIVATE = `activate-${UNIQUE}`;
const TREE_DELETE = `delete-${UNIQUE}`;

async function openComposerOnSwift(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/instructor/skill-tree');
  await expect(page.getByRole('heading', { name: /skill tree composer/i })).toBeVisible({
    timeout: 10_000,
  });
  // Pick the curriculum-published Swift Fundamentals track (has lessons,
  // unlike the Kotlin placeholder).
  const trackSelect = page.locator('select#track');
  await expect(trackSelect.locator('option:not([value=""])').first()).toBeAttached({
    timeout: 8_000,
  });
  const options = await trackSelect.locator('option').allTextContents();
  const swiftOption = options.find((o) => /\(swift\)/i.test(o));
  if (!swiftOption) test.skip(true, 'no Swift track to compose against');
  await trackSelect.selectOption({ label: swiftOption! });
  await page.waitForTimeout(500);
}

async function createTree(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /save as new tree/i }).click();
  await page.locator('input#tree-name').fill(name);
  await page.getByRole('button', { name: /create tree/i }).click();
  // Wait for the success banner / your-trees row to appear.
  await expect(page.getByText(new RegExp(name, 'i')).first()).toBeVisible({ timeout: 8_000 });
}

test.describe('Composer secondary actions', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
    await openComposerOnSwift(page);
  });

  test('toggle visibility flips private ↔ public', async ({ page }) => {
    await createTree(page, TREE_VIS);
    // The newly-created tree is loaded into the editor; the visibility
    // badge reads "private". The toggle is labelled "Make public" or
    // "Make private" depending on current state.
    const makePublic = page.getByRole('button', { name: /make public/i }).first();
    await expect(makePublic).toBeVisible({ timeout: 5_000 });
    await makePublic.click();
    // After toggling, the visibility badge should now read "public" and
    // the button flips to "Make private".
    await expect(page.getByRole('button', { name: /make private/i }).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('activate on cohort then clear assignment', async ({ page }) => {
    await createTree(page, TREE_ACTIVATE);
    // The default cohort selector picks the test instructor's cohort.
    // "Activate on cohort" → success banner mentions the cohort short id.
    const activateBtn = page.getByRole('button', { name: /activate on cohort/i });
    if (!(await activateBtn.isVisible().catch(() => false))) {
      test.skip(true, 'no cohort in the picker — seed must include a cohort');
    }
    await activateBtn.click();
    await expect(page.getByText(/activated|is active on this cohort/i).first()).toBeVisible({
      timeout: 8_000,
    });

    // Clear the assignment → cohort flips back to default sequence.
    const clearBtn = page.getByRole('button', { name: /clear assignment/i });
    await expect(clearBtn).toBeVisible({ timeout: 5_000 });
    await clearBtn.click();
    await expect(
      page.getByText(/reverted to the default|using the default published sequence/i).first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('delete tree removes it from "Your trees"', async ({ page }) => {
    await createTree(page, TREE_DELETE);
    // After create, the editor shows the new tree loaded with the "Delete
    // tree" button available (owned + not assigned).
    const deleteBtn = page.getByRole('button', { name: /delete tree/i });
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
    // The current implementation deletes immediately without a confirm
    // dialog (the destructive action is bounded by "assignments must be
    // cleared first" on the server). If a future change adds a confirm()
    // prompt we'll need to wire `page.on('dialog', d => d.accept())`.
    await deleteBtn.click();
    await expect(page.getByText(/deleted/i).first()).toBeVisible({ timeout: 8_000 });
    // The tree no longer appears in "Your trees".
    await expect(
      page.getByText(new RegExp(`^${TREE_DELETE}$`, 'i')),
    ).toHaveCount(0, { timeout: 5_000 });
  });

  test('swap a lesson opens the picker modal', async ({ page }) => {
    // Don't need a saved tree — the default-loaded sequence already has
    // Swap buttons. Click the first one, confirm the modal opens, cancel.
    const swap = page.getByRole('button', { name: /^swap$/i }).first();
    if (!(await swap.isVisible().catch(() => false))) {
      test.skip(true, 'no swap buttons rendered (track has no lessons?)');
    }
    await swap.click();
    // The SwapLessonModal renders inside a Modal with a title containing "lesson".
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    // Cancel out — we don't actually want to swap in any lesson here.
    await modal.getByRole('button', { name: /cancel|close/i }).first().click();
    await expect(modal).toBeHidden({ timeout: 5_000 });
  });
});
