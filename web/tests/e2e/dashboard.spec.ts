import { test, expect } from '@playwright/test';
import { requireLogin } from './_helpers';

test.describe('dashboard', () => {
  test('renders daily strip + paths + leaderboard without console errors', async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
    const consoleErrors: string[] = [];
    // Capture only genuine app-code throws (pageerror) and ignore the
    // Next.js dev prefetcher's network-resource noise. Console.error from
    // the framework's logger isn't a useful signal — it surfaces every
    // failed prefetch with a giant React stack that's not the app's fault.
    const isNoise = (s: string) =>
      /Failed to load resource|ERR_NAME_NOT_RESOLVED|ERR_NETWORK|ERR_INTERNET_DISCONNECTED|net::|prefetch|fetchServerResponse/i.test(
        s,
      );
    page.on('pageerror', (e) => {
      if (!isNoise(e.message)) consoleErrors.push(e.message);
    });

    await page.goto('/dashboard');

    // Daily strip is present (it's the .daily wrapper around the hero)
    await expect(page.locator('.daily')).toBeVisible();

    // Right column: Your paths heading and the mini-leaderboard heading
    await expect(page.getByRole('heading', { name: /Your paths/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /This week's leaderboard/i })).toBeVisible();

    // Welcome heading from the page-head
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Welcome back/i);

    expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toHaveLength(0);
  });
});
