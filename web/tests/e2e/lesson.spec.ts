import { test, expect } from '@playwright/test';


const SEED_LESSON_ID = '22222222-2222-4222-8222-222222222222';

test('renders Hello BootCamp lesson and answers a multiple choice', async ({ page }) => {
  await page.goto(`/lesson/${SEED_LESSON_ID}`);
  await expect(page.getByRole('heading', { name: 'Hello BootCamp' })).toBeVisible();

  const sidebar = page.getByRole('navigation', { name: 'exercises' });
  await expect(sidebar.getByText('multiple_choice')).toBeVisible();
  await expect(sidebar.getByText('fill_blank')).toBeVisible();
  await expect(sidebar.getByText('predict_output')).toBeVisible();
  await expect(sidebar.getByText('code')).toBeVisible();
  await expect(sidebar.getByText('fix_bug')).toBeVisible();

  await page.getByLabel('Swift').check();
  await page.getByRole('button', { name: /check/i }).click();
  await expect(page.getByText(/correct/i)).toBeVisible();
});

test.skip('Swift code exercise: Run compiles and passes', async ({ page }) => {
  await page.goto('/lesson/22222222-2222-4222-8222-222222222222?ex=5');
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  const editor = page.locator('textarea').first();
  await editor.fill('func greet() -> String { return "hello" }');
  await page.getByRole('button', { name: 'Run tests' }).click();
  await expect(page.getByText(/tests passed/i)).toBeVisible({ timeout: 30_000 });
});

test.skip('grading: submit MC, see points', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(`grade${Date.now()}@test.com`);
  await page.getByLabel(/name/i).fill('Grader');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('/');

  await page.goto('/lesson/22222222-2222-4222-8222-222222222222?ex=1');
  await page.getByLabel('Swift').check();
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page.getByText(/points/i)).toBeVisible({ timeout: 10_000 });
});

test.skip('gamification: submit and see badge unlock', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(`badge${Date.now()}@test.com`);
  await page.getByLabel(/name/i).fill('Badge Hunter');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('/');
  await page.goto('/lesson/22222222-2222-4222-8222-222222222222?ex=1');
  await page.getByLabel('Swift').check();
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page.getByText(/badge unlocked/i)).toBeVisible({ timeout: 10_000 });
});

test.skip('auth flow: register, run code, sign out, run blocked', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(`test${Date.now()}@test.com`);
  await page.getByLabel(/name/i).fill('Test User');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('/');

  await page.goto('/lesson/22222222-2222-4222-8222-222222222222?ex=5');
  await page.getByRole('button', { name: /run tests/i }).click();
  await expect(page.getByText(/tests passed|tests failed|compile error|timed out/i)).toBeVisible({ timeout: 30_000 });

  await page.getByLabel(/settings/i).click();
  await page.getByRole('button', { name: /sign out/i }).click();

  await page.goto('/lesson/22222222-2222-4222-8222-222222222222?ex=5');
  await page.getByRole('button', { name: /run tests/i }).click();
  await expect(page.getByText(/sign in/i)).toBeVisible();
});

test.skip('AI review: submit code and see review loading', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(`review${Date.now()}@test.com`);
  await page.getByLabel(/name/i).fill('Reviewer');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('/');
  await page.goto('/lesson/22222222-2222-4222-8222-222222222222?ex=5');
  const editor = page.locator('textarea').first();
  await editor.fill('func greet() -> String { return "Hello, BootCamp!" }');
  await page.getByRole('button', { name: /submit/i }).click();
});
