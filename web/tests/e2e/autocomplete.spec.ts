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

// Steps in the seeded "Hello BootCamp" lesson assignment:
//   step 5 = Swift code exercise
// The Kotlin code block is filtered out of the seeded student's assignment,
// so we only e2e the Swift autocomplete path. Kotlin's static provider is
// covered by unit tests in tests/monaco/language-services.test.ts.
const STEP_CODE_SWIFT = 5;

async function openSwiftCodeExercise(page: Page): Promise<void> {
  await page.goto(`/lesson/${SEED.lessonId}?step=${STEP_CODE_SWIFT}`);
  // Wait for the player shell, then for Monaco to attach.
  await expect(page.getByRole('button', { name: /back to track/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 15_000 });
}

async function focusEditor(page: Page): Promise<void> {
  const editor = page.locator('.monaco-editor').first();
  await editor.click();
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
    await openSwiftCodeExercise(page);
    // Give the editor a beat to mount and run beforeMount.
    await page.waitForTimeout(1500);
    const installLog = logs.find((l) => /Monaco language services installed/.test(l));
    expect(installLog, `expected [bootcamp] install log, got: ${JSON.stringify(logs)}`).toBeTruthy();
    expect(installLog).toContain('swift=true');
    expect(installLog).toContain('kotlin=true');
  });

  test('typing a Swift keyword shows our keyword suggestions', async ({ page }) => {
    await openSwiftCodeExercise(page);
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
    await openSwiftCodeExercise(page);
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
    expect(
      matches.length,
      `expected at least 2 Array methods, got: ${labels}`,
    ).toBeGreaterThanOrEqual(2);
  });
});
