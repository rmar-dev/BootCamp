import { test, expect } from '@playwright/test';

test.describe('app shell', () => {
  test('unauthenticated user is redirected from /dashboard to /login', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('authenticated student sees the new chrome on /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /skill tree/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /design system/i }).first()).toBeVisible();
    const search = page.getByPlaceholder(/search lessons coming soon/i);
    await expect(search).toBeVisible();
    await expect(search).toBeDisabled();
  });

  test('user pill toggles SettingsMenu and density chip flips data-density', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /open settings/i }).click();
    await page.getByRole('button', { name: 'compact' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    await page.getByRole('button', { name: 'comfortable' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
  });
});
