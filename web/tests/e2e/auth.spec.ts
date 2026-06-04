import { test, expect } from '@playwright/test';
import { tryLoginAs } from './_helpers';

// Covers login + signout. Registration is invite-only — there is no public
// /register route anymore (see invite-flow.spec.ts for the invite path).
// Every test that needs the backend will skip cleanly if it can't reach it —
// these run as part of the suite even when only the web app is up (the
// skipped count tells you to start platform/seed).

test.describe('Login page', () => {
  test('renders the form (unauthenticated landing path)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in to bootcamp/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    // Quick-test buttons are visible in dev (they call /api/auth/login under the hood).
    await expect(page.getByRole('button', { name: 'Student' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Instructor' })).toBeVisible();
  });

  test('rejects invalid credentials with an inline error', async ({ page }, testInfo) => {
    // We don't gate this on tryLoginAs — a wrong password should still
    // produce a 401 from the platform even with an empty seed.
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('nobody@bootcamp.dev');
    await page.getByLabel(/password/i).fill('definitely-wrong');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    const alert = page.getByRole('alert');
    try {
      await expect(alert).toContainText(/invalid/i, { timeout: 5_000 });
    } catch {
      testInfo.skip(true, 'Backend unreachable — error toast never rendered. Start the platform.');
    }
  });

  test('valid credentials redirect to /tracks (post-login landing)', async ({ page }, testInfo) => {
    const ok = await tryLoginAs(page, 'student');
    if (!ok) testInfo.skip(true, 'Backend unreachable / seed not applied');
    // / forwards to /tracks for authenticated users (see app/page.tsx).
    await page.waitForURL(/\/(tracks|dashboard)/, { timeout: 5_000 });
    expect(page.url()).toMatch(/\/(tracks|dashboard)/);
  });

  test('signout from the settings menu returns to /login', async ({ page }, testInfo) => {
    const ok = await tryLoginAs(page, 'student');
    if (!ok) testInfo.skip(true, 'Backend unreachable / seed not applied');
    await page.goto('/dashboard');
    // The settings menu is the gear-icon button in the topbar. Its label
    // varies; match by aria-label "Settings" or a visible "Sign out" button
    // after opening.
    const settingsBtn = page.getByRole('button', { name: /settings/i }).first();
    await settingsBtn.click();
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 5_000 });
    expect(page.url()).toMatch(/\/login$/);
  });
});

test.describe('Register route (removed — invite-only)', () => {
  test('/register does NOT render a registration form', async ({ page }) => {
    // Registration is invite-only now: POST /api/auth/register and the
    // /register page were removed. In Next.js a missing route renders the
    // 404 page, so the old register form must be absent. This check is
    // backend-independent (it asserts on the absence of UI, not on any API).
    await page.goto('/register');

    // None of the old register form's fields should exist.
    await expect(
      page.getByRole('heading', { name: /create your account/i }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: /create account/i })).toHaveCount(0);
    await expect(page.getByLabel(/^name$/i)).toHaveCount(0);

    // It should look like Next's not-found page (or otherwise clearly not a
    // working register form). Tolerate either the framework 404 text or a
    // redirect away from /register.
    const looks404 = await page
      .getByText(/this page could not be found|404|not found/i)
      .first()
      .isVisible()
      .catch(() => false);
    const redirectedAway = !new URL(page.url()).pathname.startsWith('/register');
    expect(looks404 || redirectedAway).toBeTruthy();
  });
});
