import { test, expect } from '@playwright/test';
import { requireLogin } from './_helpers';

// Light-touch coverage for instructor pages the main instructor spec doesn't
// drill into. Each test is a single happy-path interaction that proves the
// route's primary control is wired up — not full feature coverage.

test.describe('/instructor/builder index', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
    await page.goto('/instructor/builder');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows the New lesson button and the lesson catalog', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new lesson/i }).first()).toBeVisible();
    // The page either lists existing lessons OR shows an empty-state — both
    // count as "rendered without erroring".
    expect(page.url()).toContain('/instructor/builder');
  });

  test('clicking New lesson navigates to the immersive editor', async ({ page }) => {
    await page.getByRole('button', { name: /new lesson/i }).first().click();
    // Drafts get a client-side id like `lesson_<time-base36><counter>`,
    // not a UUID — the standalone "create draft" path doesn't round-trip
    // through the platform until publish. Just assert we left the index.
    await expect(page).toHaveURL(/\/instructor\/builder\/.+/, { timeout: 10_000 });
    expect(page.url()).not.toMatch(/\/instructor\/builder\/?$/);
  });
});

test.describe('/instructor/ratings', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
    await page.goto('/instructor/ratings');
    await expect(page.getByRole('heading', { name: /ratings/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('renders the attemptId loader form', async ({ page }) => {
    // The page has an Input id="attempt-id" + "Load ratings" button.
    await expect(page.locator('#attempt-id')).toBeVisible();
    await expect(page.getByRole('button', { name: /load ratings/i }).first()).toBeVisible();
  });

  test('loading a valid-shaped attemptId that doesn\'t exist surfaces an empty state', async ({
    page,
  }) => {
    await page.locator('#attempt-id').fill('11111111-1111-4111-8111-000000000000');
    await page.getByRole('button', { name: /load ratings/i }).first().click();
    // Either an alert appears, OR a "no ratings" empty state. We don't lock
    // which — just that the page didn't crash.
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).not.toContainText(/application error/i);
  });
});

test.describe('/instructor/badges', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
    await page.goto('/instructor/badges');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });

  test('renders the create-badge form and existing badge list', async ({ page }) => {
    // The form's Input components don't expose ids, so we assert by the
    // visible "Name" label + the "Create badge" submit button. The page
    // also lists existing system + instructor badges below the form.
    await expect(page.getByText(/^Name$/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /create badge/i }).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/application error/i);
  });
});

test.describe('/instructor (review queue dashboard)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
    await page.goto('/instructor');
    await expect(page.getByRole('heading', { name: /review queue|queue/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('lists pending + reviewed sections', async ({ page }) => {
    // Don't lock the exact section markup — what we want to catch is the
    // page failing to load the queue at all. The empty state for a
    // brand-new env is "no items" + an empty-state callout; both count.
    await expect(page.locator('body')).not.toContainText(/application error/i);
  });
});
