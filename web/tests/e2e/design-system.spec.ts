import { test, expect } from '@playwright/test';
import { requireLogin } from './_helpers';

// /design-system is now gated behind requireInstructor() — log in as
// instructor first. (Previously this route was public.)

test.describe('design system showcase', () => {
  test('renders without console errors and toggles theme + density', async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
    const consoleErrors: string[] = [];
    // Filter Next.js dev prefetch / network noise — under parallel-worker
    // load the prefetcher times out and logs a TypeError that's not the
    // page under test's fault. See dashboard.spec.ts for the same pattern.
    const isNoise = (s: string) =>
      /Failed to load resource|ERR_NAME_NOT_RESOLVED|ERR_NETWORK|net::|prefetch|fetchServerResponse|Failed to fetch RSC|TypeError: Failed to fetch/i.test(
        s,
      );
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isNoise(msg.text())) consoleErrors.push(msg.text());
    });

    await page.goto('/design-system');

    // Foundations heading present
    await expect(page.getByRole('heading', { name: 'Tokens' })).toBeVisible();

    // Initial theme attribute exists
    const initialTheme = await page.locator('html').getAttribute('data-theme');
    expect(['dark', 'light']).toContain(initialTheme);

    // Toggle theme via TweaksPanel — click whichever option isn't current
    const oppositeTheme = initialTheme === 'dark' ? 'light' : 'dark';
    await page.getByRole('button', { name: oppositeTheme }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', oppositeTheme);

    // Toggle density to compact
    await page.getByRole('button', { name: 'compact' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');

    // Toggle density back to comfortable
    await page.getByRole('button', { name: 'comfortable' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');

    expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toHaveLength(0);
  });
});
