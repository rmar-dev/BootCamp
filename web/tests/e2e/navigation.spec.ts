import { test, expect } from '@playwright/test';
import { requireLogin, SEED } from './_helpers';

// Click-driven navigation. Most route-smoke checks visit URLs directly;
// these specs ensure the user-visible affordances (sidebar links, topbar
// chips, settings menu) actually wire those URLs up.

test.describe('Sidebar navigation (student)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
    await page.goto('/dashboard');
  });

  test('Dashboard → Skill tree → Profile → Leaderboard → Dashboard', async ({ page }) => {
    await page.getByRole('link', { name: /skill tree/i }).first().click();
    await expect(page).toHaveURL(/\/tracks/, { timeout: 8_000 });

    await page.getByRole('link', { name: /^profile$/i }).first().click();
    await expect(page).toHaveURL(/\/profile/, { timeout: 8_000 });

    await page.getByRole('link', { name: /^leaderboard$/i }).first().click();
    await expect(page).toHaveURL(/\/leaderboard/, { timeout: 8_000 });

    await page.getByRole('link', { name: /^dashboard$/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8_000 });
  });

  test('More section + Design system are hidden for student', async ({ page }) => {
    await expect(page.getByText(/^more$/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /design system/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^review$/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^instructor$/i })).toHaveCount(0);
  });
});

test.describe('Sidebar navigation (instructor)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'instructor');
    await page.goto('/dashboard');
  });

  test('Instructor → Students → Help inbox → Skill tree → Builder', async ({ page }) => {
    await page.getByRole('link', { name: /^instructor$/i }).first().click();
    await expect(page).toHaveURL(/\/instructor$/, { timeout: 8_000 });

    await page.getByRole('link', { name: /^students$/i }).first().click();
    await expect(page).toHaveURL(/\/instructor\/students/, { timeout: 8_000 });

    await page.getByRole('link', { name: /help inbox/i }).first().click();
    await expect(page).toHaveURL(/\/instructor\/help/, { timeout: 8_000 });

    // There are TWO "Skill tree" links in the instructor sidebar — the
    // student one (/tracks) and the instructor composer (/instructor/skill-tree).
    // The composer link sits inside the More section; match it precisely
    // by href.
    await page.locator('a[href="/instructor/skill-tree"]').click();
    await expect(page).toHaveURL(/\/instructor\/skill-tree/, { timeout: 8_000 });

    await page.getByRole('link', { name: /^builder$/i }).first().click();
    await expect(page).toHaveURL(/\/instructor\/builder/, { timeout: 8_000 });
  });
});

test.describe('Topbar language switcher', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Instructor sees the full track catalogue (no student-language filter),
    // so the topbar should expose at least one language chip.
    await requireLogin(page, testInfo, 'instructor');
    await page.goto('/dashboard');
  });

  test('chips reflect available track languages', async ({ page }) => {
    // The topbar's SegmentedControl renders one `<button>` per *unique*
    // language across the user's visible tracks. The buttons live inside
    // `.topbar > .seg`. Sidebar also has nav-link buttons for the same
    // language words so we scope by the topbar wrapper.
    const topbar = page.locator('.topbar');
    await expect(topbar).toBeVisible({ timeout: 8_000 });
    const swiftChip = topbar.locator('.seg button', { hasText: /^Swift$/ });
    const kotlinChip = topbar.locator('.seg button', { hasText: /^Kotlin$/ });
    const total = (await swiftChip.count()) + (await kotlinChip.count());
    expect(total, 'topbar should expose at least one language chip').toBeGreaterThan(0);
  });
});

test.describe('Continue Lesson + Back to track', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
  });

  test('Back to track inside a lesson returns to /tracks', async ({ page }) => {
    await page.goto(`/lesson/${SEED.lessonId}`);
    await page.getByRole('button', { name: /back to track/i }).click();
    await expect(page).toHaveURL(/\/tracks/, { timeout: 8_000 });
  });
});

test.describe('Settings menu', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
    await page.goto('/dashboard');
  });

  test('opens, flips density attribute, closes', async ({ page }) => {
    await page.getByRole('button', { name: /open settings/i }).click();
    await page.getByRole('button', { name: 'compact' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    await page.getByRole('button', { name: 'comfortable' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
  });
});
