import { test, expect } from '@playwright/test';
import { requireLogin } from './_helpers';

// Smoke-load every lesson published in the Swift Fundamentals curriculum
// (~12 at last count). The IDs are content-hashed by the curriculum
// compiler, so we discover them at runtime via /api/tracks/<id> rather
// than hardcoding. What this guards against is one specific lesson
// crashing the player on render — a regression that wouldn't surface
// from the "Hello BootCamp" seed lesson alone.

test.describe.configure({ mode: 'serial' });

test('every Swift Fundamentals lesson opens without a runtime crash', async ({
  page,
}, testInfo) => {
  // Login as student so the auth cookie is on the browser context — then
  // use page.request for API calls (cookies attach). The plain `request`
  // fixture in Playwright is per-test and doesn't share with `page`, so
  // login-then-call-API has to happen on the same context.
  await requireLogin(page, testInfo, 'student');

  const tracksRes = await page.request.get('http://localhost:3002/api/tracks');
  if (!tracksRes.ok()) {
    testInfo.skip(true, `/api/tracks returned ${tracksRes.status()}`);
  }
  const tracks = (await tracksRes.json()) as Array<{
    id: string;
    language: string;
    title: string;
  }>;
  const swift = tracks.find(
    (t) => t.language === 'swift' && /swift fundamentals/i.test(t.title),
  );
  if (!swift) {
    testInfo.skip(
      true,
      'no curriculum published — run `npx tsx compile.ts --publish swift-fundamentals` in curriculum/',
    );
  }
  const detailRes = await page.request.get(
    `http://localhost:3002/api/tracks/${swift!.id}`,
  );
  if (!detailRes.ok()) {
    testInfo.skip(true, `track detail returned ${detailRes.status()}`);
  }
  const detail = (await detailRes.json()) as {
    lessons: Array<{ id: string; title: string }>;
  };
  expect(detail.lessons.length).toBeGreaterThan(0);

  // One smoke per lesson. We don't submit anything — just prove the player
  // shell renders without an error overlay.
  for (const lesson of detail.lessons) {
    await page.goto(`/lesson/${lesson.id}`);
    // Wait for ANY of: the player shell (Back to track button), a
    // "not found" / "couldn't load" inline error, or our own "Loading…"
    // disappearing. Then assert no error overlay surfaced.
    await page
      .waitForFunction(
        () => {
          const text = document.body.innerText.toLowerCase();
          return (
            text.includes('back to track') ||
            text.includes('not found') ||
            text.includes("couldn't load") ||
            text.includes('lesson not found')
          );
        },
        { timeout: 15_000 },
      )
      .catch(() => {
        // The body never settled into any known state — that's fine, the
        // assertion below catches the application-error case.
      });
    await expect(page.locator('body')).not.toContainText(/application error/i);
  }
});
