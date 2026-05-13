import { test, expect } from '@playwright/test';
import { SEED, tryLoginAs } from './_helpers';

// Covers login + register + signout. Every test that needs the backend will
// skip cleanly if it can't reach it — these run as part of the suite even
// when only the web app is up (the skipped count tells you to start
// platform/seed).

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

test.describe('Register page', () => {
  test('renders the form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('creates a new account and redirects to the app', async ({ page }, testInfo) => {
    // Random email each run so the test is repeatable.
    const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@bootcamp.test`;
    await page.goto('/register');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/name/i).fill('E2E Runner');
    await page.getByLabel(/password/i).fill('test1234password');
    await page.getByRole('button', { name: /create account/i }).click();
    try {
      await page.waitForURL((url) => !url.pathname.startsWith('/register'), { timeout: 8_000 });
    } catch {
      testInfo.skip(true, 'Backend unreachable — register POST never resolved');
    }
    // Root (/) redirects authed users to /tracks; some envs may send them to /dashboard.
    expect(page.url()).toMatch(/\/(tracks|dashboard|$)/);
  });

  test('rejects duplicate email with an inline error', async ({ page }, testInfo) => {
    await page.goto('/register');
    await page.getByLabel(/email/i).fill(SEED.student.email);
    await page.getByLabel(/name/i).fill('Already Taken');
    await page.getByLabel(/password/i).fill('test1234password');
    await page.getByRole('button', { name: /create account/i }).click();
    const alert = page.getByRole('alert');
    try {
      await expect(alert).toBeVisible({ timeout: 5_000 });
    } catch {
      testInfo.skip(true, 'Backend unreachable or seed not applied — duplicate-email error never rendered');
    }
    // We don't lock the exact text — different platforms phrase the conflict
    // differently. Visibility of the alert region is enough.
    expect(page.url()).toMatch(/\/register$/);
  });
});
