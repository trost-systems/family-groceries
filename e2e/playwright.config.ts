import { defineConfig, devices } from '@playwright/test';
import { fakeOidcPort, webPort as port } from './stack';

// Job 28: the timings in tests/perf.spec.ts take 4-5 minutes, so they run only when named:
// `npx playwright test tests/perf.spec.ts`, or `scripts/ci-e2e.sh --spec tests/perf.spec.ts`.
const timingsAsked = process.argv.some((arg) => /perf/.test(arg));

export default defineConfig({
  testDir: './tests',
  grepInvert: timingsAsked ? undefined : /@perf/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // One locally: the box's RAM is shared by parallel jobs (COORDINATION.md, Memory).
  workers: process.env.CI ? 2 : 1,
  // One retry, which fixtures.ts lets run only after a host stall (VM pause) cut the attempt.
  retries: 1,
  // The JSON report is what the job summary and scripts/ci-e2e.sh read (scripts/e2e-summary.sh).
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'playwright-results.json' }]]
    : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /iphone\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 480, height: 900 },
        // Supabase Auth sends the browser to the fake identity provider by the
        // name its container knows it under.
        launchOptions: { args: ['--host-resolver-rules=MAP host.docker.internal 127.0.0.1'] },
      },
    },
    // Job 28: Safari's engine. As an iPhone for the tap focus, as a desktop for the timings
    // (the mouse wheel does not scroll a mobile WebKit page).
    { name: 'iphone', testMatch: /iphone\.spec\.ts/, use: { ...devices['iPhone 15'] } },
    { name: 'webkit', testMatch: /perf\.spec\.ts/, use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: `node serve.mjs ../app/build/web ${port}`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Every copy signs with the same key, so one left running is reusable.
      command: `node fake-oidc.mjs ${fakeOidcPort}`,
      url: `http://127.0.0.1:${fakeOidcPort}/realms/test/.well-known/openid-configuration`,
      reuseExistingServer: true,
    },
  ],
});
