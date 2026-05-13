import { defineConfig } from '@playwright/test';

// Prod / staging smoke config. Run with:
//   BOOTCAMP_PROD_URL=https://bootcamp.rmar.site \
//     npx playwright test --config=playwright.config.prod.ts
//
// Differences from playwright.config.ts:
//   - Targets prod-smoke.spec.ts only (read-only, no submissions, no DB writes)
//   - No webServer (we're hitting a deployed origin, not running one locally)
//   - No globalSetup (no DB to re-seed)
//   - 1 worker — we're being polite to a real origin
//   - Higher timeouts — real-network round-trips dwarf local-loopback ones

const PROD_URL = process.env.BOOTCAMP_PROD_URL ?? 'https://bootcamp.rmar.site';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /prod-smoke\.spec\.ts$/,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: PROD_URL,
    ignoreHTTPSErrors: false,
  },
});
