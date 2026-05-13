import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // prod-smoke runs via playwright.config.prod.ts against a deployed origin
  // (no webServer / no seed). Exclude it from the local dev suite.
  testIgnore: /prod-smoke\.spec\.ts$/,
  // Runs once before all tests — re-seeds the platform DB so the suite's
  // submission tests start from a clean attempt history.
  globalSetup: require.resolve('./tests/e2e/_global-setup.ts'),
  // 4 workers overwhelms the dev server's response time (Next.js prefetcher
  // races + Monaco CDN load) and causes flaky "Failed to fetch RSC" /
  // "click timeout" failures that don't reproduce in isolation. 2 workers
  // is the sweet spot: fast enough (~1.3min for the full suite) and stable.
  workers: 2,
  use: { baseURL: 'http://localhost:3001' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
