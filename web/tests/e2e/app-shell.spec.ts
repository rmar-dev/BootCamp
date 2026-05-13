import { test, expect } from '@playwright/test';
import { requireLogin } from './_helpers';

test.describe('app shell', () => {
  test('unauthenticated user is redirected from /dashboard to /login', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/dashboard');
    // The (authed)/layout.tsx renders "Loading…" while useAuth resolves, then
    // useEffect fires router.replace('/login'). Under load (parallel workers
    // hammering the dev server) the round-trip can take a few seconds — give
    // it a generous window so this stays robust.
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('authenticated student sees the new chrome on /dashboard', async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /skill tree/i }).first()).toBeVisible();
    // Design system link is gated to instructor/admin (lives under the
    // isInstructor branch in components/shell/Sidebar.tsx). Students must
    // NOT see it.
    await expect(page.getByRole('link', { name: /design system/i })).toHaveCount(0);
    const search = page.getByPlaceholder(/search lessons coming soon/i);
    await expect(search).toBeVisible();
    await expect(search).toBeDisabled();
  });

  test('instructor sees the design system link in the More section', async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /design system/i }).first()).toBeVisible();
  });

  test('user pill toggles SettingsMenu and density chip flips data-density', async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /open settings/i }).click();
    await page.getByRole('button', { name: 'compact' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    await page.getByRole('button', { name: 'comfortable' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
  });
});
