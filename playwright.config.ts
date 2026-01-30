import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'

const baseURL = 'http://localhost:5678'

export default defineConfig<ConfigOptions>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  timeout: 120_000,
  webServer: {
    command: 'NODE_ENV=test pnpm build && pnpm preview --port 5678',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    nuxt: {
      rootDir: fileURLToPath(new URL('.', import.meta.url)),
      host: baseURL,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
