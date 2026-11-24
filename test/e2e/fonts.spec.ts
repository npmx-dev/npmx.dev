import type { Page } from '@playwright/test'
import { expect, test } from './test-utils'

const FONT_RE = /\/_nuxt\/fonts\/[^/]+\.woff2$/

declare global {
  interface Window {
    layoutShifts: number[]
  }
}

async function renderedFonts(page: Page, selector: string) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument')
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector })
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
  return fonts.map(font => font.familyName)
}

test.describe('Fonts', () => {
  test('preloads Geist and Geist Mono as immutable build assets', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    const urls = await page
      .locator('link[rel="preload"][as="font"]')
      .evaluateAll(links => links.map(link => (link as HTMLLinkElement).href))
    expect(urls).toHaveLength(2)

    for (const url of urls) {
      expect(url).toMatch(FONT_RE)
      const response = await page.request.get(url)
      expect(response.status()).toBe(200)
      expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable')
    }
  })

  test('adds metric-matched fallbacks to the font stacks', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    const stacks = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return ['--font-sans', '--font-mono'].map(name => style.getPropertyValue(name).trim())
    })
    expect(stacks[0]).toMatch(
      /^"Geist", "Geist Fallback: [^"]+".*"Geist Fallback: Liberation Sans"/,
    )
    expect(stacks[1]).toMatch(
      /^"Geist Mono", "Geist Mono Fallback: [^"]+".*"Geist Mono Fallback: Liberation Mono"/,
    )
  })

  test('renders text in Geist and Geist Mono from the font cache', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL })
    try {
      const page = await context.newPage()
      await page.goto('/privacy', { waitUntil: 'networkidle' })
      await page.goto('/privacy', { waitUntil: 'networkidle' })
      const faces = await page.evaluate(async () => {
        await document.fonts.ready
        return Array.from(document.fonts, face => ({
          family: face.family.replaceAll('"', ''),
          weight: face.weight,
        })).filter(face => face.family === 'Geist' || face.family === 'Geist Mono')
      })

      expect(faces).toEqual([
        { family: 'Geist', weight: '100 900' },
        { family: 'Geist Mono', weight: '100 900' },
      ])
      expect(await renderedFonts(page, 'main p')).toEqual(['Geist'])
      expect(await renderedFonts(page, 'h1')).toEqual(['Geist Mono'])
    } finally {
      await context.close()
    }
  })

  test('keeps the blog column width without Geist', async ({ page, goto }) => {
    await page.route(FONT_RE, route => route.abort())
    await goto('/blog/alpha-release', { waitUntil: 'hydration' })

    const widths = await page
      .locator('main article.prose, main > div.max-w-prose')
      .evaluateAll(elements => elements.map(element => getComputedStyle(element).maxWidth))
    expect(widths).toEqual(['715px', '715px'])
  })

  test('does not shift layout when fonts load late', async ({ page, goto }) => {
    const delayedFonts = new Set<string>()
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.route(FONT_RE, async route => {
      await new Promise(resolve => setTimeout(resolve, 500))
      await route.continue()
      delayedFonts.add(route.request().url())
    })
    await page.addInitScript(() => {
      window.layoutShifts = []
      new PerformanceObserver(list => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number })[]) {
          window.layoutShifts.push(entry.value)
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })

    await goto('/privacy', { waitUntil: 'hydration' })
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(() => new Promise(requestAnimationFrame))

    expect(delayedFonts.size).toBe(2)
    expect(await page.evaluate(() => window.layoutShifts)).toEqual([])
  })
})
