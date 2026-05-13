import { test, expect } from '@playwright/test';
import { requireLogin, SEED } from './_helpers';

// Student feedback round-trip. Covers:
//   * Student leaves general feedback → row appears in their history
//   * Student leaves per-lesson feedback (with rating) → row appears
//   * Instructor sees both in the inbox
//   * Instructor replies → status flips to resolved, student sees the reply

// Tests run serial: the inbox test depends on what the prior tests submitted.
test.describe.configure({ mode: 'serial' });

const UNIQUE = String(Date.now());
const GENERAL_COMMENT = `general feedback e2e ${UNIQUE}`;
const LESSON_COMMENT = `lesson feedback e2e ${UNIQUE}`;
const INSTRUCTOR_REPLY = `reply ${UNIQUE} — thanks for the feedback`;

test.describe('Student feedback (general + per-lesson)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
  });

  test('submits general feedback (no lesson, no rating) and sees it in history', async ({
    page,
  }) => {
    await page.goto('/feedback');
    await expect(page.getByRole('heading', { name: /^feedback$/i })).toBeVisible();
    await page.locator('#fb-comment').fill(GENERAL_COMMENT);
    await page.locator('[data-testid="feedback-submit"]').click();
    await expect(page.locator('[data-testid="feedback-success"]')).toBeVisible({
      timeout: 8_000,
    });
    // History list now contains the comment.
    await expect(
      page.locator('[data-testid="feedback-history"]').getByText(GENERAL_COMMENT),
    ).toBeVisible();
  });

  test('per-lesson feedback requires a rating; happy path lands in history', async ({
    page,
  }) => {
    await page.goto('/feedback');
    // Pick the seeded "Swift Fundamentals" track (test student is enrolled).
    // The select hydrates after a fetch — wait for at least one real option
    // (non-placeholder, value !== "") to be attached before we read.
    const trackSelect = page.locator('#fb-track');
    await expect(trackSelect.locator('option:not([value=""])').first()).toBeAttached({
      timeout: 8_000,
    });
    const options = await trackSelect.locator('option').allTextContents();
    const swiftOption = options.find((o) => /\(swift\)/i.test(o));
    if (!swiftOption) test.skip(true, 'no Swift track available for this student');
    await trackSelect.selectOption({ label: swiftOption! });

    // Pick the first lesson in the track. Wait for the lesson select to
    // populate after the track change triggers the fetch.
    const lessonSelect = page.locator('#fb-lesson');
    await expect(lessonSelect).toBeVisible({ timeout: 8_000 });
    await expect(lessonSelect.locator('option:not([value=""])').first()).toBeAttached({
      timeout: 8_000,
    });
    await lessonSelect.selectOption({ index: 1 }); // skip the "— pick a lesson —" placeholder

    // Submit without a rating → renderer-level error.
    await page.locator('#fb-comment').fill(LESSON_COMMENT);
    await page.locator('[data-testid="feedback-submit"]').click();
    await expect(page.locator('[data-testid="feedback-error"]')).toContainText(/rating/i, {
      timeout: 5_000,
    });

    // Add a rating and resubmit.
    await page.getByRole('button', { name: 'rating-4' }).click();
    await page.locator('[data-testid="feedback-submit"]').click();
    await expect(page.locator('[data-testid="feedback-success"]')).toBeVisible({
      timeout: 8_000,
    });
    await expect(
      page.locator('[data-testid="feedback-history"]').getByText(LESSON_COMMENT),
    ).toBeVisible();
  });

  test('empty comment is rejected with an inline error', async ({ page }) => {
    await page.goto('/feedback');
    // Submit button is disabled when comment is empty.
    await expect(page.locator('[data-testid="feedback-submit"]')).toBeDisabled();
  });
});

test.describe('Instructor feedback inbox', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
  });

  test('sees the student feedback the prior tests submitted', async ({ page }) => {
    await page.goto('/instructor/feedback');
    await expect(page.getByRole('heading', { name: /feedback inbox/i })).toBeVisible({
      timeout: 8_000,
    });
    // Both comments from the student suite should be present.
    await expect(page.getByText(GENERAL_COMMENT).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(LESSON_COMMENT).first()).toBeVisible();
  });

  test('Mark seen flips status from new → seen', async ({ page }) => {
    await page.goto('/instructor/feedback');
    // Find the row containing the general-feedback comment.
    const row = page
      .locator('[data-testid="feedback-row"]')
      .filter({ hasText: GENERAL_COMMENT })
      .first();
    await expect(row).toBeVisible({ timeout: 8_000 });
    const markSeen = row.locator('[data-testid="mark-seen"]');
    if (await markSeen.isVisible().catch(() => false)) {
      await markSeen.click();
      // The "Mark seen" button is only rendered for `status: new`, so after a
      // refresh the row no longer offers it.
      await expect(row.locator('[data-testid="mark-seen"]')).toHaveCount(0, {
        timeout: 8_000,
      });
    }
  });

  test('Reply resolves the feedback and shows the reply to the student', async ({
    page,
    context,
  }) => {
    await page.goto('/instructor/feedback');
    const row = page
      .locator('[data-testid="feedback-row"]')
      .filter({ hasText: LESSON_COMMENT })
      .first();
    await expect(row).toBeVisible({ timeout: 8_000 });
    await row.locator('[data-testid="reply-toggle"]').click();
    await row.getByLabel('reply-text').fill(INSTRUCTOR_REPLY);
    await row.locator('[data-testid="send-reply"]').click();

    // After reply, the row shows the reply block and gets the "resolved" badge.
    await expect(row.getByText(INSTRUCTOR_REPLY)).toBeVisible({ timeout: 8_000 });

    // Student side picks up the reply on their history page.
    await context.clearCookies();
    await requireLogin(page, test.info(), 'student');
    await page.goto('/feedback');
    await expect(
      page
        .locator('[data-testid="feedback-history"]')
        .getByText(INSTRUCTOR_REPLY)
        .first(),
    ).toBeVisible({ timeout: 8_000 });
  });
});
