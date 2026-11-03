import { defineConfig } from '@playwright/test';

// One Playwright run at a time on the shared hosts: scripts/store-screenshots.sh holds /tmp/fg-e2e.lock
// around it (COORDINATION.md).
export default defineConfig({
  testDir: '.',
  testMatch: /capture\.spec\.mjs/,
  globalTeardown: './teardown.mjs',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 240_000,
  reporter: 'list',
  use: {
    headless: true,
    // The invite scene's page runs at https://app.hummlist.com (app.mjs) and talks to the local
    // stack on 127.0.0.1, which Chromium's local network checks would block.
    launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests'] },
  },
});
