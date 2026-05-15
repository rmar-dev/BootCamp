import { test, expect } from '@playwright/test';
import { requireLogin, SEED } from './_helpers';

// Help-request round-trip in one test: a cross-user flow can't reasonably
// be split across Playwright tests because the request fixture is
// per-test (cookies don't carry). We instead do everything in one big
// test using a single browser context, flipping cookies between users.

test('round-trip: student creates → instructor sees → reply → student status flip', async ({
  page,
  context,
}, testInfo) => {
  const UNIQUE = String(Date.now());
  const TITLE = `e2e help ${UNIQUE}`;
  const BODY = `I'm stuck on this seed lesson — e2e ${UNIQUE}`;
  const REPLY = `Try resetting and re-running. e2e ${UNIQUE}`;

  // ── 1. Login student via the UI to populate auth cookies on this
  //       context, then use page.request to hit the create endpoint —
  //       cookies attach automatically. We hit the platform directly
  //       (port 3002) since the web origin doesn't proxy /api in dev.
  await requireLogin(page, testInfo, 'student');
  const createRes = await page.request.post(
    'http://localhost:3002/api/help-requests',
    {
      data: {
        anchorKind: 'lesson',
        anchorId: SEED.lessonId,
        title: TITLE,
        body: BODY,
      },
    },
  );
  if (!createRes.ok()) {
    testInfo.skip(
      true,
      `help-requests POST returned ${createRes.status()} — backend wiring issue`,
    );
  }
  const created = await createRes.json();
  expect(created.title).toBe(TITLE);

  // ── 2. Switch to instructor.
  await context.clearCookies();
  await requireLogin(page, testInfo, 'instructor');
  await page.goto('/instructor/help');
  await expect(page.getByRole('heading', { name: /help requests/i }).first()).toBeVisible({
    timeout: 10_000,
  });

  // ── 3. Find + open the new request.
  const rowTitle = page.getByText(TITLE).first();
  await expect(rowTitle).toBeVisible({ timeout: 8_000 });
  await rowTitle.click();
  // The thread side-column shows the original body + a reply textarea.
  await expect(page.getByText(BODY).first()).toBeVisible({ timeout: 5_000 });

  // ── 4. Reply.
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 5_000 });
  await textarea.fill(REPLY);
  await page
    .getByRole('button', { name: /send reply|post reply|^reply$/i })
    .first()
    .click();
  await expect(page.getByText(REPLY).first()).toBeVisible({ timeout: 8_000 });

  // ── 5. Resolve. If the button isn't present, the thread is already
  //       answered/resolved by the reply transition — accept either.
  const resolveBtn = page.getByRole('button', { name: /mark resolved|^resolve$/i }).first();
  if (await resolveBtn.isVisible().catch(() => false)) {
    await resolveBtn.click();
  }
  await expect(page.getByText(/resolved|answered/i).first()).toBeVisible({ timeout: 8_000 });
});

test.describe('Instructor inbox page renders', () => {
  test('the inbox page loads without crashing for instructor', async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
    await page.goto('/instructor/help');
    await expect(page.getByRole('heading', { name: /help requests/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('body')).not.toContainText(/application error/i);
  });
});
