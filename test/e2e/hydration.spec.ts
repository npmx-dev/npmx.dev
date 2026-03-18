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
  '/search?q=vue',
] as const

// ---------------------------------------------------------------------------
// Test matrix
//
// For each user setting, we test two states across all pages:
//   1. undefined — empty localStorage, the default/fresh-install experience
//   2. a non-default value — verifies hydration still works when the user has
//      changed that setting from its default
// ---------------------------------------------------------------------------

test.describe('Hydration', () => {
  test.describe('no user settings (empty localStorage)', () => {
    for (const page of PAGES) {
      test(`${page}`, async ({ goto, hydrationErrors }) => {
        await goto(page, { waitUntil: 'hydration' })

        expect(hydrationErrors).toEqual([])
      })
    }
  })

  // Default: "system" → test explicit "dark"
  test.describe('color mode: dark', () => {
    for (const page of PAGES) {
      test(`${page}`, async ({ page: pw, goto, hydrationErrors }) => {
        await injectLocalStorage(pw, { 'npmx-color-mode': 'dark' })
        await goto(page, { waitUntil: 'hydration' })

        expect(hydrationErrors).toEqual([])
      })
    }
  })

  // Default: null → test "violet"
  test.describe('accent color: violet', () => {
    for (const page of PAGES) {
      test(`${page}`, async ({ page: pw, goto, hydrationErrors }) => {
        await injectLocalStorage(pw, {
          'npmx-settings': JSON.stringify({ accentColorId: 'violet' }),
        })
        await goto(page, { waitUntil: 'hydration' })

        expect(hydrationErrors).toEqual([])
      })
    }
  })

  // Default: null → test "slate"
  test.describe('background theme: slate', () => {
    for (const page of PAGES) {
      test(`${page}`, async ({ page: pw, goto, hydrationErrors }) => {
        await injectLocalStorage(pw, {
          'npmx-settings': JSON.stringify({ preferredBackgroundTheme: 'slate' }),
        })
        await goto(page, { waitUntil: 'hydration' })

        expect(hydrationErrors).toEqual([])
      })
    }
  })

  // Default: "npm" → test "pnpm"
  test.describe('package manager: pnpm', () => {
    for (const page of PAGES) {
      test(`${page}`, async ({ page: pw, goto, hydrationErrors }) => {
        await injectLocalStorage(pw, {
          'npmx-pm': JSON.stringify('pnpm'),
        })
        await goto(page, { waitUntil: 'hydration' })

        expect(hydrationErrors).toEqual([])
      })
    }
  })

  // Default: "en-US" (LTR) → test "ar-EG" (RTL)
  test.describe('locale: ar-EG (RTL)', () => {
    for (const page of PAGES) {
      test(`${page}`, async ({ page: pw, goto, hydrationErrors }) => {
        await injectLocalStorage(pw, {
          'npmx-settings': JSON.stringify({ selectedLocale: 'ar-EG' }),
        })
        await goto(page, { waitUntil: 'hydration' })

        expect(hydrationErrors).toEqual([])
      })
    }
  })

  // Default: false → test true
  test.describe('relative dates: enabled', () => {
    for (const page of PAGES) {
      test(`${page}`, async ({ page: pw, goto, hydrationErrors }) => {
        await injectLocalStorage(pw, {
          'npmx-settings': JSON.stringify({ relativeDates: true }),
        })
        await goto(page, { waitUntil: 'hydration' })

        expect(hydrationErrors).toEqual([])
      })
    }
  })
})

async function injectLocalStorage(page: Page, entries: Record<string, string>) {
  await page.addInitScript((e: Record<string, string>) => {
    for (const [key, value] of Object.entries(e)) {
      localStorage.setItem(key, value)
    }
  }, entries)
}
