import { test, expect, type Page } from '@playwright/test';
import { requireLogin, SEED } from './_helpers';

// Smoke-tests every route. Each test:
//   1. Logs in with the role the route requires
//   2. Visits the URL
//   3. Asserts the URL didn't bounce back to /login
//   4. Asserts a route-specific landmark element rendered (so we'd catch a
//      runtime error that crashes the page after navigation succeeds)
//
// Failures from a missing backend → skip, not fail. Failures from a real
// regression → fail loudly.

async function assertNoErrorState(page: Page): Promise<void> {
  // Next.js renders a default error overlay when a server component throws.
  // We don't want to depend on its exact markup, so just check we didn't
  // land on the framework "Application error" string.
  await expect(page.locator('body')).not.toContainText(/application error: a client-side exception/i);
}

test.describe('Student-visible routes render without bouncing to /login', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
  });

  for (const { name, path, landmark } of [
    { name: 'dashboard', path: '/dashboard', landmark: /dashboard|today|continue/i },
    { name: 'tracks', path: '/tracks', landmark: /your path forward|skill tree/i },
    { name: 'profile', path: '/profile', landmark: /profile/i },
    { name: 'leaderboard', path: '/leaderboard', landmark: /leaderboard/i },
    { name: 'badges', path: '/badges', landmark: /badges?/i },
  ]) {
    test(`student → ${path}`, async ({ page }) => {
      await page.goto(path);
      // Should not have bounced to /login.
      expect(page.url()).not.toMatch(/\/login/);
      // Must render some sort of marker for that route — guards against a
      // runtime error after route nav succeeds.
      await expect(page.locator('body')).toContainText(landmark, { timeout: 8_000 });
      await assertNoErrorState(page);
    });
  }

  test('lesson immersive route renders the seeded "Hello BootCamp" lesson', async ({ page }) => {
    await page.goto(`/lesson/${SEED.lessonId}`);
    await expect(page.getByRole('heading', { name: /hello bootcamp/i })).toBeVisible({
      timeout: 10_000,
    });
    await assertNoErrorState(page);
  });

  test('students are kicked off /review (instructor-only)', async ({ page }) => {
    await page.goto('/review');
    // requireInstructor() server-side redirects students → /dashboard.
    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 5_000 });
  });

  test('students are kicked off /design-system (instructor-only)', async ({ page }) => {
    await page.goto('/design-system');
    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 5_000 });
  });

  test('students are kicked off /instructor (instructor-only)', async ({ page }) => {
    await page.goto('/instructor');
    await expect(page).toHaveURL(/\/(dashboard|login)/, { timeout: 5_000 });
  });
});

test.describe('Instructor-only routes render for instructor', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
  });

  for (const { path, landmark } of [
    { path: '/instructor', landmark: /review queue|queue/i },
    { path: '/instructor/students', landmark: /students|roster/i },
    { path: '/instructor/help', landmark: /help|inbox/i },
    { path: '/instructor/ratings', landmark: /ratings/i },
    { path: '/instructor/builder', landmark: /builder|lessons/i },
    { path: '/instructor/skill-tree', landmark: /skill tree composer|skill trees/i },
    { path: '/instructor/badges', landmark: /badges?/i },
    { path: '/review', landmark: /review/i },
    { path: '/design-system', landmark: /design system|primitives|composites|foundations/i },
  ]) {
    test(`instructor → ${path}`, async ({ page }) => {
      await page.goto(path);
      expect(page.url()).not.toMatch(/\/login/);
      await expect(page.locator('body')).toContainText(landmark, { timeout: 8_000 });
      await assertNoErrorState(page);
    });
  }
});

test.describe('Admin can reach every route', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'admin');
  });

  for (const path of [
    '/dashboard',
    '/tracks',
    '/profile',
    '/leaderboard',
    '/badges',
    '/review',
    '/instructor',
    '/instructor/students',
    '/instructor/help',
    '/instructor/ratings',
    '/instructor/builder',
    '/instructor/skill-tree',
    '/instructor/badges',
    '/design-system',
  ]) {
    test(`admin → ${path}`, async ({ page }) => {
      await page.goto(path);
      expect(page.url()).not.toMatch(/\/login/);
      await assertNoErrorState(page);
    });
  }
});

test.describe('Unauthenticated users land on /login', () => {
  // No login in beforeEach — we want to test the redirect.
  test('/, /dashboard, /tracks, /lesson/*, /instructor/* all redirect to /login', async ({ page }) => {
    for (const path of [
      '/',
      '/dashboard',
      '/tracks',
      `/lesson/${SEED.lessonId}`,
      '/instructor',
      '/profile',
    ]) {
      await page.context().clearCookies();
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
    }
  });
});
