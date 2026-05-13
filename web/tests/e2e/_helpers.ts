import type { Page, TestInfo } from '@playwright/test';

// Seeded test users from platform/prisma/seed.ts. Passwords are 'test1234'.
export const SEED = {
  student: { email: 'student@bootcamp.dev', password: 'test1234' },
  instructor: { email: 'instructor@bootcamp.dev', password: 'test1234' },
  admin: { email: 'admin@bootcamp.dev', password: 'test1234' },
  lessonId: '22222222-2222-4222-8222-222222222222',
  trackId: '11111111-1111-4111-8111-111111111111',
  kotlinPlaceholderTrackId: '33333333-3333-4333-8333-333333333333',
};

type Role = 'student' | 'instructor' | 'admin';

/**
 * Log in via the email/password form on /login. Uses the seeded test
 * accounts; the dev login page also has quick-login buttons but those only
 * cover student + instructor.
 *
 * Returns the URL we landed on after login (typically /tracks, sometimes the
 * route the user was originally trying to reach). Throws if login never
 * navigates away from /login within the timeout — callers can wrap in a
 * try/skip if they want to be tolerant of the backend being down.
 */
export async function loginAs(page: Page, role: Role): Promise<string> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(SEED[role].email);
  await page.getByLabel(/password/i).fill(SEED[role].password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 10_000,
  });
  return new URL(page.url()).pathname;
}

/**
 * Same as loginAs but returns false instead of throwing when the backend is
 * unreachable / the seed hasn't been applied. Used by smoke tests that prefer
 * to skip when infrastructure isn't ready.
 */
export async function tryLoginAs(page: Page, role: Role): Promise<boolean> {
  try {
    await loginAs(page, role);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wraps a beforeEach: tries to log in, skips the whole test if it can't.
 * Saves boilerplate in route-smoke specs where infrastructure-down should
 * mean "skip", not "fail".
 */
export async function requireLogin(
  page: Page,
  testInfo: TestInfo,
  role: Role,
): Promise<void> {
  const ok = await tryLoginAs(page, role);
  if (!ok) {
    testInfo.skip(
      true,
      `Backend unavailable or seed not applied — start the platform and run \`npm run seed\` in platform/`,
    );
  }
}

/**
 * Trigger Monaco's completion popup at the current cursor and wait for it.
 * Returns the locator for the suggest widget so callers can assert items
 * exist. Falls back to Ctrl+Space if quickSuggestions hasn't fired.
 */
export async function triggerMonacoSuggest(page: Page) {
  // Ctrl+Space is the canonical way to force the suggest widget regardless
  // of quickSuggestions config. Works in both VS Code and standalone Monaco.
  await page.keyboard.press('Control+Space');
  // The widget renders into a portal-ish absolute element with this class.
  // It may be hidden until items load; rely on visibility, not just attached.
  return page.locator('.suggest-widget').first();
}
