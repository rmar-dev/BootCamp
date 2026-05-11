import { test, expect } from '@playwright/test';

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
    await page.goto('/tracks');
    await expect(page.getByRole('heading', { name: 'Your path forward.' })).toBeVisible();
    await expect(page.locator('.tree-section').first()).toBeVisible();
    await expect(page.locator('button.node').first()).toBeVisible();
  });

  test('clicking an available lesson node navigates to /lesson/{id}', async ({ page }) => {
    await page.goto('/tracks');
    await expect(page.locator('.tree-section').first()).toBeVisible();
    const node = page.locator('button.node:not(.locked):not(.completed)').first();
    await node.click();
    await expect(page).toHaveURL(/\/lesson\/.+/);
  });

  test('locked nodes do not navigate (button disabled)', async ({ page }) => {
    await page.goto('/tracks');
    await expect(page.locator('.tree-section').first()).toBeVisible();
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
    // Navigate to /tracks first to ensure tracks are loaded into context
    await page.goto('/tracks');
    await expect(page.locator('.tree-section').first()).toBeVisible();
    // Now hit a /tracks/[id] URL — the redirect always lands on /tracks per spec D4
    // regardless of whether the ID exists (if not, active track stays unchanged).
    await page.goto('/tracks/swift');
    await expect(page).toHaveURL(/\/tracks$/);
  });

  test('sidebar Continue Lesson regression: still navigates to /tracks', async ({ page }) => {
    await page.goto('/dashboard');
    // The continue lesson button is in the sidebar; it has href="/tracks" per ContinueLessonButton.tsx
    // Label is "Continue lesson" (lowercase 'l')
    const continueLink = page.getByRole('link', { name: /continue lesson/i }).first();
    await continueLink.click();
    await expect(page).toHaveURL(/\/tracks$/);
  });
});
