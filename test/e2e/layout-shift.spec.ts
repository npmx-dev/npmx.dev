import type { Page } from '@playwright/test'
import { expect, test } from './test-utils'

const PAGES = [
  '/',
  '/about',
  '/settings',
  '/privacy',
  '/compare',
  '/search',
  '/package/nuxt',
  '/package-code/empathic/v/2.0.0',
  '/search?q=vue',
] as const

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 640, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
] as const

const PLATFORMS = {
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  macos:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
} as const

interface LayoutShift {
  value: number
  sources: { node: string; previousRect: string; currentRect: string }[]
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number
  hadRecentInput: boolean
  sources: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[]
}

declare global {
  interface Window {
    layoutShifts: LayoutShift[]
    useNuxtApp: () => { $router: { push: (to: string) => Promise<unknown> } }
  }
}

async function observeLayoutShifts(page: Page) {
  // TODO: stop blocking fonts once Geist has metric-matched fallbacks for every weight
  await page.route(/\.(?:ttf|woff2?)$/, route => route.abort())
  await page.addInitScript(() => {
    window.layoutShifts = []

    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (entry.hadRecentInput) continue
        window.layoutShifts.push({
          value: entry.value,
          sources: entry.sources.map(({ node, previousRect: prev, currentRect: curr }) => ({
            node:
              node instanceof Element
                ? `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}.${[...node.classList].slice(0, 4).join('.')}`
                : (node?.nodeName ?? 'unknown'),
            previousRect: `${prev.x},${prev.y} ${prev.width}x${prev.height}`,
            currentRect: `${curr.x},${curr.y} ${curr.width}x${curr.height}`,
          })),
        })
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
}

async function collectLayoutShifts(page: Page) {
  await page.waitForLoadState('networkidle')
  return page.evaluate(
    () =>
      new Promise<LayoutShift[]>(resolve => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, 500, window.layoutShifts)),
        )
      }),
  )
}

for (const [platform, userAgent] of Object.entries(PLATFORMS)) {
  test.describe(`Layout shift (${platform})`, () => {
    test.use({ userAgent })

    for (const viewport of VIEWPORTS) {
      test.describe(`${viewport.width}x${viewport.height}`, () => {
        test.use({ viewport })

        for (const path of PAGES) {
          test(path, async ({ page, goto }) => {
            await observeLayoutShifts(page)
            await goto(path, { waitUntil: 'hydration' })

            if (platform === 'macos') {
              await expect(page.locator('html')).toHaveAttribute('data-platform', 'apple')
            }
            expect(await collectLayoutShifts(page)).toEqual([])
          })
        }
      })
    }
  })
}

test.describe('Layout shift on reload after client-side navigation', () => {
  for (const viewport of [{ width: 360, height: 800 }, VIEWPORTS[4]]) {
    test(`${viewport.width}x${viewport.height} /compare`, async ({ page, goto }) => {
      await page.setViewportSize(viewport)
      await observeLayoutShifts(page)
      await goto('/', { waitUntil: 'hydration' })
      await page.evaluate(() => window.useNuxtApp().$router.push('/compare'))
      await page.waitForURL('/compare')
      await page.reload()

      await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()
      expect(await collectLayoutShifts(page)).toEqual([])
    })
  }
})

test.describe('macOS shortcut label', () => {
  test.use({ userAgent: PLATFORMS.macos, viewport: { width: 1280, height: 800 } })

  test('shows before hydration with malformed settings', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('npmx-settings', '{'))
    await page.route(/\/_nuxt\/.*\.js$/, route => route.abort())
    await page.goto('/package/nuxt')

    await expect(page.locator('header [data-platform-only="apple"]')).toBeVisible()
  })

  test('shows in the SPA fallback', async ({ page }) => {
    await page.route('**/package/nuxt', async route => {
      const response = await route.fetch({ url: new URL('/200.html', route.request().url()).href })
      await route.fulfill({ response })
    })
    await page.goto('/package/nuxt')

    await expect(page.locator('header [data-platform-only="apple"]')).toBeVisible()
  })
})

test('formats dates in the selected locale before hydration', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('npmx-settings', JSON.stringify({ selectedLocale: 'en-GB' }))
  })
  await page.route(/\/_nuxt\/.*\.js$/, route => route.abort())
  await page.goto('/package/nuxt')

  await expect(page.locator('dl time').last()).toHaveText(/^\d{1,2} \w{3} \d{4}$/)
})
