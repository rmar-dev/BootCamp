import { test, expect } from '@playwright/test';

test.describe('dashboard', () => {
  test('renders daily strip + paths + leaderboard without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
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
