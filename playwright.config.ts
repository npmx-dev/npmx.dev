import process from 'node:process'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'

const baseURL = 'http://localhost:5678'

export default defineConfig<ConfigOptions>({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['html'], ['junit', { outputFile: 'test-report.junit.xml' }]]
    : 'html',
  timeout: 120_000,
  webServer: {
    command: 'pnpm start:playwright:webserver',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...process.env,
      // Dummy Socket credentials so the Socket security source is active in
      // e2e; actual API calls are intercepted by the fixture plugin
      // (modules/runtime/server/cache.ts). The public flag must be set
      // explicitly because the build runs without the credentials.
      NUXT_SOCKET_API_KEY: 'npmx-test-fixture-key',
      NUXT_SOCKET_ORG_SLUG: 'npmx-test-fixtures',
      NUXT_PUBLIC_SOCKET_CONFIGURED: 'true',
    },
  },
  // Start/stop mock connector server before/after all tests (teardown via returned closure)
  globalSetup: join(import.meta.dirname, 'test/e2e/global-setup.ts'),
  // We currently only test on one browser on one platform
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  use: {
    baseURL,
    trace: 'on-first-retry',
    nuxt: {
      rootDir: import.meta.dirname,
      host: baseURL,
    },
  },
  projects: [
    {
      name: 'chromium-headless-shell',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
