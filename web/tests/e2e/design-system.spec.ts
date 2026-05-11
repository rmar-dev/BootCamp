import { test, expect } from '@playwright/test';

// /design-system is public; opt out of authenticated storage state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('design system showcase', () => {
  test('renders without console errors and toggles theme + density', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
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
