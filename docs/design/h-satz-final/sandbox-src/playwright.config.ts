import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4189',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    browserName: 'chromium',
  },
  projects: [
    { name: 'mouse', testIgnore: /touch\.spec/ },
    { name: 'touch', testMatch: /touch\.spec/, use: { hasTouch: true, isMobile: true } },
  ],
  webServer: {
    command: 'npx vite preview --port 4189 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4189',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
