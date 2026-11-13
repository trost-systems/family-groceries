import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4190',
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    browserName: 'chromium',
  },
  webServer: {
    command: 'npx vite preview --port 4190 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4190',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
