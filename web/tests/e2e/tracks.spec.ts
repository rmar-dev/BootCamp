import { test, expect } from '@playwright/test';

// The curriculum-published Swift Fundamentals track is the only seed-enrolled
// track with lessons (the Kotlin placeholder has zero). Use the /tracks/[id]
// redirect to set Swift as the active track before each test that needs a
// non-empty tree to render.
const SWIFT_FUNDAMENTALS_ID = 'b47181f2-5a75-5505-b330-1080818db95a';

async function activateSwiftTrack(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`/tracks/${SWIFT_FUNDAMENTALS_ID}`);
  await expect(page).toHaveURL(/\/tracks$/, { timeout: 8_000 });
}

// Helper: log in as the dev student via the quick-login button on /login.
// Requires the NestJS backend running on port 3000 with the seed applied
// (`npm run seed` in platform/). Returns true if auth succeeded, false otherwise.
async function loginAsStudent(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Student' }).click();
  // Wait for the page to navigate away from /login
  const landed = await page
    .waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  return landed;
}

test.describe('Tracks page', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const authed = await loginAsStudent(page);
    if (!authed) {
      testInfo.skip(
        true,
        'Backend unavailable — run `npm run seed` in platform/ and start the NestJS server on port 3000',
      );
    }
  });

  test('renders the skill tree with at least one section and lesson node', async ({ page }) => {
    await activateSwiftTrack(page);
    await expect(page.getByRole('heading', { name: 'Your path forward.' })).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.locator('.tree-section').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('button.node').first()).toBeVisible();
  });

  test('clicking an available lesson node navigates to /lesson/{id}', async ({ page }) => {
    await activateSwiftTrack(page);
    await expect(page.locator('.tree-section').first()).toBeVisible({ timeout: 8_000 });
    const node = page.locator('button.node:not(.locked):not(.completed)').first();
    await node.click();
    await expect(page).toHaveURL(/\/lesson\/.+/);
  });

  test('locked nodes do not navigate (button disabled)', async ({ page }) => {
    await activateSwiftTrack(page);
    await expect(page.locator('.tree-section').first()).toBeVisible({ timeout: 8_000 });
    const lockedNodes = page.locator('button.node.locked');
    const count = await lockedNodes.count();
    if (count === 0) {
      test.skip(true, 'No locked nodes in fixture (all sections complete)');
    }
    const before = page.url();
    await lockedNodes.first().click({ force: true }).catch(() => { /* disabled buttons may reject click */ });
    expect(page.url()).toBe(before);
  });

  test('redirect: /tracks/[id] sets the active track and lands on /tracks', async ({ page }) => {
    await activateSwiftTrack(page);
    await expect(page.locator('.tree-section').first()).toBeVisible({ timeout: 8_000 });
    // Now hit a /tracks/[id] URL — the redirect always lands on /tracks per spec D4
    // regardless of whether the ID exists (if not, active track stays unchanged).
    await page.goto('/tracks/swift');
    await expect(page).toHaveURL(/\/tracks$/);
  });

  test('sidebar Continue Lesson navigates to the current lesson (or /tracks if none)', async ({ page }) => {
    await page.goto('/dashboard');
    // ContinueLessonButton resolves to /lesson/<currentLessonId> if there is
    // a current lesson on the active track, otherwise /tracks. Either is a
    // valid landing target for this regression test — what we're guarding
    // against is the button hanging or 404-ing.
    const continueLink = page.getByRole('link', { name: /continue lesson/i }).first();
    await continueLink.click();
    await expect(page).toHaveURL(/\/(tracks|lesson\/.+)$/, { timeout: 8_000 });
  });
});
