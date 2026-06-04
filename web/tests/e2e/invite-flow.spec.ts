import { test, expect } from '@playwright/test';
import { tryLoginAs } from './_helpers';

// End-to-end invite-only flow. Requires a live platform with the dev seed
// (admin@bootcamp.dev / test1234 — exposed via SEED in _helpers.ts and used
// here through tryLoginAs('admin')). The whole spec skips cleanly if the
// backend is unreachable, mirroring the skip pattern in auth.spec.ts.
//
// Flow under test:
//   1. Admin logs in and invites an instructor from /admin. The issued card
//      surfaces the magic link (/accept-invite?token=...).
//   2. A fresh (cookie-cleared) browser visits that link, sets a password,
//      and lands authenticated at /.
//   3. The new instructor invites a student from /instructor/students and
//      gets their own magic link card.

test.describe('Invite-only flow', () => {
  test('admin invites instructor → activate → instructor invites student', async ({
    page,
    context,
  }, testInfo) => {
    // --- 1. Log in as admin -------------------------------------------------
    const ok = await tryLoginAs(page, 'admin');
    if (!ok) {
      testInfo.skip(true, 'Backend unreachable / seed not applied — start the platform and seed');
    }

    // Unique email per run so re-running the suite never collides on a
    // previously-invited address. Date.now() is fine in test code.
    const stamp = Date.now();
    const instructorEmail = `e2e-instructor-${stamp}@bootcamp.test`;
    const studentEmail = `e2e-student-${stamp}@bootcamp.test`;

    // --- 2. Invite an instructor from /admin --------------------------------
    await page.goto('/admin');
    await page.getByPlaceholder('Full name').fill('E2E Instructor');
    await page.getByPlaceholder('name@example.com').fill(instructorEmail);
    await page.getByRole('button', { name: /create invitation/i }).click();

    // The InvitationCard exposes the link via aria-label="Magic link".
    const adminMagicLink = page.getByLabel('Magic link');
    await expect(adminMagicLink).toBeVisible({ timeout: 10_000 });
    const acceptUrl = await adminMagicLink.inputValue();
    expect(acceptUrl).toContain('/accept-invite?token=');

    // --- 3. Activate the instructor account via the magic link --------------
    // Clear cookies so we're acting as the freshly-invited user, not the admin.
    await context.clearCookies();
    // The link is an absolute origin URL; goto handles it directly.
    await page.goto(acceptUrl);

    await expect(page.getByRole('heading', { name: /set your password/i })).toBeVisible();
    await page.getByPlaceholder('New password').fill('test1234password');
    await page.getByPlaceholder('Confirm password').fill('test1234password');
    await page.getByRole('button', { name: /activate account/i }).click();

    // accept-invite logs the user in and pushes to /.
    await page.waitForURL((url) => url.pathname === '/' || !url.pathname.startsWith('/accept-invite'), {
      timeout: 10_000,
    });
    expect(new URL(page.url()).pathname).not.toContain('/accept-invite');

    // --- 4. New instructor invites a student from /instructor/students ------
    await page.goto('/instructor/students');
    await page.getByPlaceholder('Student name').fill('E2E Student');
    await page.getByPlaceholder('student@example.com').fill(studentEmail);
    // Both invite forms label their submit button "Create invitation"; scope
    // to the student form to avoid any ambiguity.
    await page
      .locator('form')
      .filter({ has: page.getByPlaceholder('student@example.com') })
      .getByRole('button', { name: /create invitation/i })
      .click();

    const studentMagicLink = page.getByLabel('Magic link');
    await expect(studentMagicLink).toBeVisible({ timeout: 10_000 });
    expect(await studentMagicLink.inputValue()).toContain('/accept-invite?token=');
  });
});
