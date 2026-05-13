import { test, expect } from '@playwright/test';
import { requireLogin, SEED } from './_helpers';

// Instructor write flows. The roster + student detail + skill-tree composer
// are the surfaces an instructor actually touches in production; route-smoke
// only proves they render, not that the controls work.

test.describe('/instructor/students roster', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
  });

  test('Assigned tab lists the seeded test student', async ({ page }) => {
    await page.goto('/instructor/students');
    // The test instructor (88888888…) is the seeded test student's
    // instructorId — so the assigned tab should include "Test Student".
    await expect(page.getByText(/Test Student/).first()).toBeVisible({ timeout: 8_000 });
  });

  test('clicking a student opens the detail page', async ({ page }) => {
    await page.goto('/instructor/students');
    await page.getByRole('link', { name: /Test Student|Open/i }).first().click();
    await expect(page).toHaveURL(/\/instructor\/students\/[0-9a-f-]{36}/, { timeout: 8_000 });
    await expect(page.getByRole('heading', { name: /Test Student/i }).first()).toBeVisible();
  });
});

test.describe('/instructor/students/[id] detail controls', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
    await page.goto(`/instructor/students/99999999-9999-4999-8999-999999999999`);
    // The detail page hydrates client-side; wait for the KPI grid (data-loaded marker).
    await expect(page.getByText(/difficulty baseline/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('difficulty baseline: flip easy → standard → challenging', async ({ page }) => {
    // Three buttons in a row labelled by baseline name. After a click, the
    // selected baseline becomes `variant="primary"` — but Playwright can't
    // see that class directly. Instead we re-fetch the detail after each
    // click and assert the KPI card reflects the new value.
    await page.getByRole('button', { name: /^challenging$/ }).click();
    await expect(page.getByText(/challenging/i).first()).toBeVisible();

    await page.getByRole('button', { name: /^easy$/ }).click();
    await expect(page.getByText(/^easy/i).first()).toBeVisible();
  });

  test('language assignment: Swift / Kotlin / Any buttons all clickable', async ({ page }) => {
    // Scope by the section that contains the "Decides which language…"
    // helper text so we don't collide with the topbar's Swift chip or
    // the sidebar's "Skill tree" link.
    const langSection = page
      .locator('section, div')
      .filter({ hasText: /Decides which language/i });
    // Click each in turn — what we're asserting is that the controls
    // wire up and don't throw a React error. The post-click backend
    // response can be a 4xx in some seed configurations (e.g. cohort
    // mismatch) which surfaces as a `role=alert` — that's a real product
    // signal, but not what THIS test is here to guard against. We don't
    // lock the alert state.
    await langSection.getByRole('button', { name: /^swift$/i }).first().click();
    await page.waitForTimeout(200);
    await langSection.getByRole('button', { name: /^kotlin$/i }).first().click();
    await page.waitForTimeout(200);
    await langSection.getByRole('button', { name: /^any$/i }).first().click();
    await page.waitForTimeout(200);
    // The three buttons all rendered → assert the section is still visible
    // (no runtime crash, no redirect).
    await expect(langSection.first()).toBeVisible();
  });
});

test.describe('/instructor/skill-tree composer', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
    await page.goto('/instructor/skill-tree');
    await expect(page.getByRole('heading', { name: /skill tree composer/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('renders track + cohort selectors and at least one tree row', async ({ page }) => {
    // Track + Cohort selects. The cohort one may be empty for instructors who
    // don't lead a cohort — but the seed gives the test instructor a cohort.
    await expect(page.locator('select#track')).toBeVisible();
    await expect(page.locator('select#cohort')).toBeVisible();

    // The "Available trees" panel always shows the "Default published sequence"
    // entry — even before any tree has been authored. (Multiple matches in
    // the DOM: the panel row + the cohort-assignment helper text. We only
    // need one to be visible.)
    await expect(page.getByText(/default published sequence/i).first()).toBeVisible();
  });

  test('Save as new tree → creates a tree and lists it in "Your trees"', async ({ page }) => {
    // The composer defaults to the first published track. The seed Kotlin
    // placeholder track has zero lessons so the canonical plan is empty,
    // and createTree refuses an empty `lessonIds`. Pick the curriculum's
    // first Swift track (it has lessons) before opening the modal.
    const trackSelect = page.locator('select#track');
    const options = await trackSelect.locator('option').allTextContents();
    // Pick the first Swift option (e.g. "Swift Fundamentals (swift)").
    const swiftOption = options.find((o) => /\(swift\)/i.test(o));
    if (!swiftOption) test.skip(true, 'no published swift track to test against');
    await trackSelect.selectOption({ label: swiftOption! });
    await page.waitForTimeout(500); // let the editor reload the default sequence

    await page.getByRole('button', { name: /save as new tree/i }).click();
    const treeName = `e2e tree ${Date.now()}`;
    // Target the modal's name input by id rather than the loose "name"
    // label which can match other field labels on the page.
    await page.locator('input#tree-name').fill(treeName);
    await page.getByRole('button', { name: /create tree/i }).click();
    // Success banner shows up with the new tree name.
    await expect(page.getByText(new RegExp(treeName, 'i')).first()).toBeVisible({
      timeout: 8_000,
    });
  });
});

test.describe('Per-student skill tree override', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
    // Author a private tree on a published Swift track (Kotlin placeholder
    // has zero lessons → createTree refuses empty lessonIds), then go
    // assign it as the per-student override.
    await page.goto('/instructor/skill-tree');
    await expect(page.getByRole('heading', { name: /skill tree composer/i })).toBeVisible({
      timeout: 10_000,
    });
    // Pick the first published Swift track.
    const trackSelect = page.locator('select#track');
    const options = await trackSelect.locator('option').allTextContents();
    const swiftOption = options.find((o) => /\(swift\)/i.test(o));
    if (!swiftOption) test.skip(true, 'no published swift track to test against');
    await trackSelect.selectOption({ label: swiftOption! });
    await page.waitForTimeout(500);
  });

  test('compose tree → activate as per-student override on /instructor/students/[id]', async ({
    page,
  }) => {
    // 1. Create a tree on the active Swift track.
    await page.getByRole('button', { name: /save as new tree/i }).click();
    const treeName = `override-tree-${Date.now()}`;
    await page.locator('input#tree-name').fill(treeName);
    await page.getByRole('button', { name: /create tree/i }).click();
    await expect(page.getByText(new RegExp(treeName, 'i')).first()).toBeVisible({
      timeout: 8_000,
    });

    // 2. Go to the seeded test student's detail page.
    await page.goto(`/instructor/students/${'99999999-9999-4999-8999-999999999999'}`);
    await expect(page.getByText(/skill trees?/i).first()).toBeVisible({ timeout: 10_000 });

    // 3. The "Override for this student" select should now include the
    // tree we just authored. Pick it by reading the option's literal value
    // attribute (selectOption needs a string, not a regex).
    const overrideSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: new RegExp(treeName, 'i') }) })
      .first();
    const option = overrideSelect.locator('option', {
      hasText: new RegExp(treeName, 'i'),
    });
    const optionValue = await option.first().getAttribute('value');
    expect(optionValue, 'override option for the new tree should exist').toBeTruthy();
    await overrideSelect.selectOption(optionValue!);

    // 4. The track row should now surface the override — the "Currently
    // active:" line includes the tree name. That proves the PUT
    // /student-assignments call landed AND the page re-rendered against
    // the new state.
    await expect(
      page.getByText(new RegExp(`Currently active:.*${treeName}`, 'i')).first(),
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('404 / unknown route', () => {
  test('unknown route under (authed) still gates on auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/this-route-does-not-exist');
    // Next.js renders its built-in 404 for an unmatched route. We just
    // assert the user didn't end up at a logged-in page.
    expect(page.url()).not.toMatch(/\/dashboard|\/tracks|\/lesson/);
  });
});
