import type { Page } from '@playwright/test'
import { expect, test } from './test-utils'
import { FORGES_PROXY_URL } from '../../shared/utils/git-providers'

const PAGES = [
  '/',
  '/about',
  '/settings',
  '/privacy',
  '/compare',
  '/search',
  '/package/nuxt',
  '/package-code/empathic/v/2.0.0',
  '/package-changelog/nuxt',
  '/search?q=vue',
  '/blog/alpha-release',
] as const

const BLOG_POSTS_WITH_MEDIA = [
  '/blog/alpha-release',
  '/blog/release/0.8',
  '/blog/release/rainbow-comet',
  '/blog/release/crystal-chronicle',
  '/blog/release/photon-genesis',
  '/blog/release/prism-forge',
] as const

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 640, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1536, height: 864 },
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
    layoutShiftsSince: number
  }
}

async function observeLayoutShifts(page: Page) {
  await page.addInitScript(() => {
    window.layoutShifts = []
    window.layoutShiftsSince = 0

    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (entry.hadRecentInput || entry.startTime < window.layoutShiftsSince) continue
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

test.describe('Layout shift', () => {
  test.use({ userAgent: PLATFORMS.linux })

  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport })

      for (const path of PAGES) {
        test(path, async ({ page, goto }) => {
          await observeLayoutShifts(page)
          await goto(path, { waitUntil: 'hydration' })

          expect(await collectLayoutShifts(page)).toEqual([])
        })
      }
    })
  }

  test('360x800 /compare reloaded with history', async ({ page, goto }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await observeLayoutShifts(page)
    await goto('/compare', { waitUntil: 'hydration' })
    await page.evaluate(() => history.replaceState({ ...history.state, back: '/' }, ''))
    await page.reload()

    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()
    expect(await collectLayoutShifts(page)).toEqual([])
  })

  test('1280x800 /~qwerzl with a short package list', async ({ page, goto }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await observeLayoutShifts(page)
    await goto('/~qwerzl', { waitUntil: 'hydration' })

    await expect(page.getByText('End of results')).toBeInViewport()
    expect(await collectLayoutShifts(page)).toEqual([])
  })

  for (const path of BLOG_POSTS_WITH_MEDIA) {
    test(`1280x800 ${path} with slow images`, async ({ page, goto }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.route(/\/blog\/.+\.(?:png|jpe?g)$/, async route => {
        await new Promise(resolve => setTimeout(resolve, 300))
        await route.fallback()
      })
      await observeLayoutShifts(page)
      await goto(path, { waitUntil: 'hydration' })

      const unsized = await page
        .locator('article :is(img, video):not(.not-prose *)')
        .evaluateAll(media =>
          media
            .filter(el => !el.hasAttribute('width') || !el.hasAttribute('height'))
            .map(el => el.getAttribute('src') ?? el.getAttribute('poster')),
        )
      expect(unsized).toEqual([])

      const aspectRatios = await page.locator('article video[poster]').evaluateAll(videos =>
        Promise.all(
          (videos as HTMLVideoElement[]).map(async video => {
            const poster = new Image()
            poster.src = video.poster
            await poster.decode()
            return [video.width / video.height, poster.naturalWidth / poster.naturalHeight] as const
          }),
        ),
      )
      for (const [video, poster] of aspectRatios) {
        expect(poster).toBeCloseTo(video, 2)
      }
      expect(await collectLayoutShifts(page)).toEqual([])
    })
  }
})

interface Navigation {
  from: string
  to: string
  loading: string
}

const NAVIGATIONS: Navigation[] = [
  { from: '/package/nuxt', to: '/package/@nuxt/kit', loading: 'main > article[aria-busy="true"]' },
  { from: '/package/@nuxt/kit', to: '/org/nuxt', loading: 'main [aria-busy="true"]' },
  { from: '/package/vue', to: '/package-code/vue/v/3.5.27', loading: 'text=Loading file tree' },
  {
    from: '/package/ufo',
    to: '/package-docs/ufo/v/1.6.3',
    loading: 'main .animate-skeleton-pulse',
  },
]

const DATA_DELAY = 500

test.describe('Layout shift after client-side navigation', () => {
  test.use({ userAgent: PLATFORMS.linux })

  for (const viewport of [VIEWPORTS[0], VIEWPORTS[4]]) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport })

      for (const { from, to, loading } of NAVIGATIONS) {
        test(`${from} → ${to}`, async ({ page, goto }) => {
          await observeLayoutShifts(page)
          await goto(from, { waitUntil: 'hydration' })
          await page.waitForLoadState('networkidle')

          const delayed = new Set<Promise<void>>()
          await page.route(/\/_payload\.json/, route =>
            route.fulfill({ contentType: 'application/json', body: '[{}]' }),
          )
          await page.route('**/*', async route => {
            const request = route.request()
            if (
              !['fetch', 'xhr'].includes(request.resourceType()) ||
              request.url().includes('/_payload.json')
            ) {
              return route.fallback()
            }
            const delay = request.url().startsWith(FORGES_PROXY_URL) ? DATA_DELAY * 2 : DATA_DELAY
            const response = new Promise(resolve => setTimeout(resolve, delay)).then(() =>
              route.fallback(),
            )
            delayed.add(response)
            await response
            delayed.delete(response)
          })

          await page.evaluate(
            href =>
              new Promise<void>(resolve => {
                const main = document.querySelector('main')!
                const check = () => {
                  if (main.isConnected) return requestAnimationFrame(check)
                  requestAnimationFrame(() => {
                    window.layoutShifts = []
                    window.layoutShiftsSince = performance.now()
                    resolve()
                  })
                }
                requestAnimationFrame(check)
                document.querySelector<HTMLElement>(`a[href="${href}"]`)!.click()
              }),
            to,
          )
          await expect(page.locator(loading).first()).toBeVisible()

          while (delayed.size) {
            await Promise.all(delayed)
            await page.waitForTimeout(100)
          }
          await expect(page.locator(loading)).toHaveCount(0)
          expect(await collectLayoutShifts(page)).toEqual([])
        })
      }
    })
  }
})

test.describe('macOS shortcut label', () => {
  test.use({ userAgent: PLATFORMS.macos, viewport: { width: 1280, height: 800 } })

  for (const path of PAGES) {
    test(`does not shift layout on ${path}`, async ({ page, goto }) => {
      await observeLayoutShifts(page)
      await goto(path, { waitUntil: 'hydration' })

      await expect(page.locator('html')).toHaveAttribute('data-platform', 'apple')
      expect(await collectLayoutShifts(page)).toEqual([])
    })
  }

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
