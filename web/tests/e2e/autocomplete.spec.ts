import { test, expect, type Page } from '@playwright/test';
import { requireLogin, SEED, triggerMonacoSuggest } from './_helpers';

// Verifies the Monaco completion popup actually appears with Swift/Kotlin
// suggestions in the lesson code editor. The static layer (lib/monaco/
// swift-language.ts, kotlin-language.ts) registers a completion provider for
// each language; this is the only e2e proof those providers reach the
// browser and that Monaco wires them up correctly.
//
// Failure modes the suite is meant to catch:
//   * Monaco loader doesn't reach the CDN (suggest widget never appears)
//   * Our beforeMount didn't fire (no Swift-only suggestions, only
//     word-based ones)
//   * The model's language id doesn't match the registered provider id
//   * A throw in registerSwiftLanguageServices kills registration

async function openSeedSwiftCodeExercise(page: Page): Promise<void> {
  // The seeded "Hello BootCamp" lesson has a Swift code block. The exercise
  // index isn't stable but the sidebar lists every block by type — we click
  // the "code" entry directly to land on it. Filter to the *swift* one in
  // case there's also a kotlin block.
  await page.goto(`/lesson/${SEED.lessonId}`);
  await expect(page.getByRole('heading', { name: /hello bootcamp/i })).toBeVisible();
  const sidebar = page.getByRole('navigation', { name: 'exercises' });
  // Click the first 'code' entry — seed has Swift code first, Kotlin code second.
  await sidebar.getByText('code', { exact: false }).first().click();
  // The editor mounts inside CodeExercise's Monaco wrapper. Wait for the
  // `.monaco-editor` class which Monaco adds once the editor is ready.
  await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 15_000 });
}

async function focusEditor(page: Page): Promise<void> {
  // Monaco's input is the hidden .inputarea inside .monaco-editor. Clicking
  // the visible editor area is the most robust way to focus it.
  const editor = page.locator('.monaco-editor').first();
  await editor.click();
  // Wait for the cursor to actually be focused — without this, the first
  // keystroke can be lost to layout.
  await page.waitForTimeout(150);
}

test.describe('Monaco autocomplete — Swift', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
  });

  test('language services log fires in console (registration succeeded)', async ({ page }) => {
    // installLanguageServices emits one info line per editor mount confirming
    // swift + kotlin are registered (see lib/monaco/index.ts).
    const logs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[bootcamp]')) logs.push(text);
    });
    await openSeedSwiftCodeExercise(page);
    // Give the editor a beat to mount and run beforeMount.
    await page.waitForTimeout(1500);
    const installLog = logs.find((l) => /Monaco language services installed/.test(l));
    expect(installLog, `expected [bootcamp] install log, got: ${JSON.stringify(logs)}`).toBeTruthy();
    expect(installLog).toContain('swift=true');
    expect(installLog).toContain('kotlin=true');
  });

  test('typing a Swift keyword shows our keyword suggestions', async ({ page }) => {
    await openSeedSwiftCodeExercise(page);
    await focusEditor(page);
    // Move to end of file and start typing a Swift-specific keyword.
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('gu', { delay: 30 });

    // The suggest widget should pop on its own (quickSuggestions: { other: true }).
    // Force it with Ctrl+Space to remove flakiness.
    const widget = await triggerMonacoSuggest(page);
    await expect(widget).toBeVisible({ timeout: 5_000 });

    // The widget renders items as .monaco-list-row. We expect 'guard' to be
    // listed (Swift keyword from SWIFT_KEYWORDS in swift-language.ts).
    const items = widget.locator('.monaco-list-row');
    await expect(items.first()).toBeVisible();
    const labels = (await items.allTextContents()).join(' | ');
    expect(labels.toLowerCase()).toContain('guard');
  });

  test('typing `[1, 2, 3].` suggests Array methods (Swift static provider)', async ({ page }) => {
    await openSeedSwiftCodeExercise(page);
    await focusEditor(page);
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    // The provider's after-dot heuristic detects `].` as Array receiver.
    await page.keyboard.type('[1, 2, 3].', { delay: 30 });
    const widget = await triggerMonacoSuggest(page);
    await expect(widget).toBeVisible({ timeout: 5_000 });
    const items = widget.locator('.monaco-list-row');
    const labels = (await items.allTextContents()).join(' | ').toLowerCase();
    // ARRAY_METHODS in swift-language.ts includes these — at least 2 of the
    // 5 ought to be present in the visible window of the widget.
    const matches = ['map', 'filter', 'reduce', 'foreach', 'first'].filter((m) =>
      labels.includes(m),
    );
    expect(matches.length, `expected at least 2 Array methods, got: ${labels}`).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Monaco autocomplete — Kotlin', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await requireLogin(page, testInfo, 'student');
  });

  test('typing `listOf(1, 2, 3).` suggests collection methods', async ({ page }) => {
    // Navigate to the Kotlin code exercise via the sidebar (second "code"
    // entry in the seed). If only one code block exists for this student
    // (Swift-only cohort), skip.
    await page.goto(`/lesson/${SEED.lessonId}`);
    await expect(page.getByRole('heading', { name: /hello bootcamp/i })).toBeVisible();
    const sidebar = page.getByRole('navigation', { name: 'exercises' });
    const codeEntries = sidebar.getByText('code', { exact: false });
    const count = await codeEntries.count();
    if (count < 2) test.skip(true, 'Seed has no Kotlin code exercise visible to this student');
    await codeEntries.nth(1).click();

    await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 15_000 });
    await focusEditor(page);
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('listOf(1, 2, 3).', { delay: 30 });
    const widget = await triggerMonacoSuggest(page);
    await expect(widget).toBeVisible({ timeout: 5_000 });
    const labels = (await widget.locator('.monaco-list-row').allTextContents()).join(' | ').toLowerCase();
    const matches = ['map', 'filter', 'fold', 'foreach', 'first', 'size'].filter((m) =>
      labels.includes(m),
    );
    expect(matches.length, `expected at least 2 Kotlin collection methods, got: ${labels}`).toBeGreaterThanOrEqual(2);
  });
});
