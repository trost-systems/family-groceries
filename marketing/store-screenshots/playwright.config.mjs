import { defineConfig } from '@playwright/test';

// One browser at a time on the shared hosts (scripts/store-screenshots.sh holds /tmp/fg-e2e.lock).
export default defineConfig({
  testDir: '.',
  testMatch: /capture\.spec\.mjs/,
  globalTeardown: './teardown.mjs',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  reporter: 'list',
  use: { headless: true },
});
