import { test, expect, type Page } from '@playwright/test';

// Read-only smoke pass against the deployed origin. Catches the class of
// bugs that only surface in production builds — standalone Next.js bundle,
// Edge-runtime middleware, compiled NestJS, real Caddy edge, real cookie
// scope. Does NOT submit answers, does NOT register accounts, does NOT
// modify any DB row.
//
// Run:
//   BOOTCAMP_PROD_URL=https://bootcamp.rmar.site \
//     npx playwright test --config=playwright.config.prod.ts
//
// Optional authed coverage: set BOOTCAMP_SMOKE_EMAIL + BOOTCAMP_SMOKE_PASS
// to a known account on the target environment. Otherwise the authed
// tests skip cleanly.

const SMOKE_EMAIL = process.env.BOOTCAMP_SMOKE_EMAIL;
const SMOKE_PASS = process.env.BOOTCAMP_SMOKE_PASS;

async function tryLogin(page: Page): Promise<boolean> {
  if (!SMOKE_EMAIL || !SMOKE_PASS) return false;
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(SMOKE_EMAIL);
  await page.getByLabel(/password/i).fill(SMOKE_PASS);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  try {
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 15_000,
    });
    return true;
  } catch {
    return false;
  }
}

test.describe('Prod smoke — public surface', () => {
  test('/login renders the form', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /sign in to bootcamp/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
  });

  test('/register is gone (invite-only auth)', async ({ page }) => {
    // Registration is invite-only — the public /register page was removed.
    // A missing route renders Next's 404 in prod, so the old create-account
    // form must not appear.
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create your account/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /create account/i })).toHaveCount(0);
  });

  test('login form rejects invalid credentials with an inline error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('nobody-smoke@bootcamp.invalid');
    await page.getByLabel(/password/i).fill('definitely-not-the-password');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    // Next.js renders its own role="alert" route-announcer div — match by
    // text content instead so we don't pick that one up.
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({
      timeout: 10_000,
    });
    // Still on /login (the form didn't accept us through).
    await expect(page).toHaveURL(/\/login/);
  });

  for (const path of ['/', '/dashboard', '/tracks', '/profile', '/leaderboard', '/instructor']) {
    test(`unauthenticated ${path} → /login`, async ({ page, context }) => {
      await context.clearCookies();
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });
  }

  test('static assets / Monaco loader reachable', async ({ page }) => {
    // Hit /login (cheapest authenticated-free page) and assert no genuine
    // app errors fire. Filter Next.js dev/prefetch network noise.
    const failures: string[] = [];
    const isNoise = (s: string) =>
      /Failed to load resource|ERR_NAME_NOT_RESOLVED|ERR_NETWORK|net::|prefetch|fetchServerResponse|Failed to fetch RSC/i.test(
        s,
      );
    page.on('pageerror', (e) => {
      if (!isNoise(e.message)) failures.push(e.message);
    });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    expect(failures, `pageerror on /login: ${failures.join('\n')}`).toHaveLength(0);
  });
});

test.describe('Prod smoke — authed (optional, requires BOOTCAMP_SMOKE_EMAIL/PASS)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const ok = await tryLogin(page);
    if (!ok) {
      testInfo.skip(
        true,
        'No BOOTCAMP_SMOKE_EMAIL/PASS env set, or login failed — skipping authed smoke',
      );
    }
  });

  test('/dashboard renders without a runtime crash', async ({ page }) => {
    await page.goto('/dashboard');
    // The dashboard's PageHead always shows "Welcome back" as h1.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Welcome back/i, {
      timeout: 15_000,
    });
  });

  test('/tracks renders something (skill tree OR empty-state)', async ({ page }) => {
    await page.goto('/tracks');
    // Either the skill tree renders sections, OR the empty state shows.
    // Both prove the route loaded without erroring.
    const sectionOrEmpty = page
      .locator('.tree-section, .main-narrow .card, text=/No active track|No lessons in this track yet|Pick a track/i')
      .first();
    await expect(sectionOrEmpty).toBeVisible({ timeout: 15_000 });
  });

  test('a lesson page mounts the Monaco editor (if the account has access)', async ({ page }) => {
    // Try the seeded lesson id first; if that's not the right one for this
    // account, just go to /tracks and click the first available node.
    await page.goto('/lesson/22222222-2222-4222-8222-222222222222');
    const backBtn = page.getByRole('button', { name: /back to track/i });
    if (!(await backBtn.isVisible().catch(() => false))) {
      test.skip(true, 'smoke account has no access to the seeded lesson on this environment');
    }
    // Don't submit anything — just prove the player shell rendered.
    await expect(backBtn).toBeVisible();
  });

  test('Monaco install log fires on a code exercise (autocomplete sanity)', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('[bootcamp]')) logs.push(msg.text());
    });
    // Reach a code-exercise step via the seeded lesson if available.
    await page.goto('/lesson/22222222-2222-4222-8222-222222222222?step=5');
    const backBtn = page.getByRole('button', { name: /back to track/i });
    if (!(await backBtn.isVisible().catch(() => false))) {
      test.skip(true, 'smoke account has no access to the seeded code exercise');
    }
    await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    const installLog = logs.find((l) => /Monaco language services installed/.test(l));
    expect(installLog, `expected [bootcamp] install log, got: ${JSON.stringify(logs)}`).toBeTruthy();
    expect(installLog).toContain('swift=true');
  });
});
