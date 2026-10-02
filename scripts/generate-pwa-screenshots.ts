#!/usr/bin/env node

/**
 * Generates PWA screenshots for Chrome's richer install UI.
 *
 * Takes screenshots of the homepage and a package page in both light and
 * dark mode, at desktop (1280×800, form_factor "wide") and mobile
 * (390×844, form_factor "narrow") viewport sizes.
 *
 * The output PNGs land in public/screenshots/ and are referenced from the
 * `screenshots` array in the PWA manifest inside nuxt.config.ts.
 *
 * Usage:
 *   # Start a local preview server automatically (requires a prior `pnpm build`):
 *   pnpm generate:screenshots
 *
 *   # Connect to an already-running server (dev, preview, or live):
 *   pnpm generate:screenshots --url http://localhost:3000
 *   pnpm generate:screenshots --url https://npmx.dev
 *
 * Deploy workflow (local):
 *   pnpm build && pnpm generate:screenshots
 *   # → commit public/screenshots/*.png, then push / deploy
 *
 * Deploy workflow (CI — screenshot the live site before rebuilding):
 *   pnpm generate:screenshots --url https://npmx.dev && pnpm build
 */

import { chromium } from '@playwright/test'
import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(rootDir, 'public', 'screenshots')
const PREVIEW_PORT = 3456

// Parse --url flag
const args = process.argv.slice(2)
const urlFlagIdx = args.indexOf('--url')
if (urlFlagIdx !== -1 && !args[urlFlagIdx + 1]) {
  throw new Error('--url flag requires a value, e.g. --url http://localhost:3000')
}
const explicitUrl = urlFlagIdx !== -1 ? args[urlFlagIdx + 1] : null

// The fixture package used for the package-detail screenshot.
// Must have a corresponding file in test/fixtures/npm-registry/packuments/.
const FIXTURE_PACKAGE = 'vue'

interface Shot {
  readonly name: string
  readonly path: string
  readonly mode: 'dark' | 'light'
  readonly viewport: { width: number; height: number }
}

const SHOTS: readonly Shot[] = [
  // Desktop (wide) — Chrome shows these in the install dialog on desktop
  { name: 'desktop-dark-home', path: '/', mode: 'dark', viewport: { width: 1280, height: 800 } },
  { name: 'desktop-light-home', path: '/', mode: 'light', viewport: { width: 1280, height: 800 } },
  {
    name: 'desktop-dark-package',
    path: `/package/${FIXTURE_PACKAGE}`,
    mode: 'dark',
    viewport: { width: 1280, height: 800 },
  },
  {
    name: 'desktop-light-package',
    path: `/package/${FIXTURE_PACKAGE}`,
    mode: 'light',
    viewport: { width: 1280, height: 800 },
  },
  // Mobile (narrow) — Chrome shows these on Android
  { name: 'mobile-dark-home', path: '/', mode: 'dark', viewport: { width: 390, height: 844 } },
  { name: 'mobile-light-home', path: '/', mode: 'light', viewport: { width: 390, height: 844 } },
  {
    name: 'mobile-dark-package',
    path: `/package/${FIXTURE_PACKAGE}`,
    mode: 'dark',
    viewport: { width: 390, height: 844 },
  },
  {
    name: 'mobile-light-package',
    path: `/package/${FIXTURE_PACKAGE}`,
    mode: 'light',
    viewport: { width: 390, height: 844 },
  },
]

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      // Any response (even 404) means the HTTP server is up
      if (res.status < 500) return
    } catch {
      /* server not ready yet — keep polling */
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs / 1000}s`)
}

async function startPreviewServer(): Promise<{ process: ChildProcess; url: string }> {
  const outputDir = join(rootDir, '.output')
  if (!existsSync(outputDir)) {
    throw new Error(
      'Build output not found. Run `pnpm build` before generating screenshots,\n' +
        'or pass --url to connect to an already-running server.',
    )
  }

  const url = `http://localhost:${PREVIEW_PORT}`
  console.log(`Starting preview server on port ${PREVIEW_PORT}…`)

  const server = spawn('pnpm', ['exec', 'nuxt', 'preview', '--port', String(PREVIEW_PORT)], {
    cwd: rootDir,
    // Pipe stderr so Nuxt startup logs don't clutter screenshot output,
    // but forward to our stderr for debugging if things go wrong.
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: process.platform === 'win32',
  })

  server.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk))

  // Throwing from an event handler wouldn't propagate to callers of this
  // function, it would just crash the process. Route it through the
  // returned promise instead, racing it against readiness polling so a
  // spawn failure (e.g. ENOENT) doesn't hang until the timeout.
  const serverError = new Promise<never>((_, reject) => {
    server.on('error', reject)
  })

  try {
    await Promise.race([waitForServer(url), serverError])
  } catch (err) {
    server.kill('SIGTERM')
    throw err
  }

  console.log('Preview server ready.\n')
  return { process: server, url }
}

try {
  mkdirSync(OUT_DIR, { recursive: true })

  let server: ChildProcess | null = null
  let baseUrl: string

  if (explicitUrl) {
    baseUrl = explicitUrl.replace(/\/$/, '')
    console.log(`Connecting to ${baseUrl}\n`)
  } else {
    const started = await startPreviewServer()
    server = started.process
    baseUrl = started.url
  }

  const browser = await chromium.launch()

  try {
    for (const shot of SHOTS) {
      const context = await browser.newContext({ viewport: shot.viewport })
      const page = await context.newPage()

      // Set color mode in localStorage before the page loads so
      // @nuxtjs/color-mode picks it up on the first render.
      await page.addInitScript((mode: string) => {
        localStorage.setItem('npmx-color-mode', mode)
      }, shot.mode)

      await page.goto(`${baseUrl}${shot.path}`, {
        waitUntil: 'networkidle',
        timeout: 30_000,
      })

      // Let CSS transitions and icon fonts finish rendering.
      await page.waitForTimeout(400)

      const outPath = join(OUT_DIR, `${shot.name}.png`)
      await page.screenshot({ path: outPath, animations: 'disabled' })
      console.log(`  ✓ ${shot.name}.png`)

      await context.close()
    }
  } finally {
    await browser.close()
    if (server) {
      server.kill('SIGTERM')
    }
  }

  console.log(`\nScreenshots saved to public/screenshots/`)
  console.log('Commit them so they are included in the next Vercel build,')
  console.log('or use `--url https://npmx.dev` in CI to skip the local server.')
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
