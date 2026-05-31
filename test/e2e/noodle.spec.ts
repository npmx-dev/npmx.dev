import type { Page } from '@playwright/test'
import { expect, test } from './test-utils'

type MockNoodle = {
  key: string
  date?: string
  dateTo?: string
  timezone?: string
  tagline?: boolean
}

type MockNoodlesOptions = {
  active?: MockNoodle[]
  permanent?: MockNoodle[]
}

function htmlAttrEncode(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function noodlePlaceholders(noodles: MockNoodle[]) {
  return noodles
    .map(
      noodle =>
        `<div id="intro-header-noodle-${noodle.key}" style="display:none" aria-hidden="true">${noodle.key}</div>`,
    )
    .join('')
}

async function mockNoodles(page: Page, options: MockNoodlesOptions = {}) {
  const active = options.active ?? []
  const permanent = options.permanent ?? []
  const activeJson = JSON.stringify(active)
  const permanentJson = JSON.stringify(permanent)

  await page.route(
    url => new URL(url).pathname === '/',
    async route => {
      const response = await route.fetch()
      const original = await response.text()

      const activeRegex = /data-active-noodles="[^"]*"/
      const permanentRegex = /data-permanent-noodles="[^"]*"/
      const taglineAnchor = '<p id="intro-header-tagline"'

      if (!activeRegex.test(original)) {
        throw new Error('mockNoodles: `data-active-noodles` marker not found in response HTML')
      }
      if (!permanentRegex.test(original)) {
        throw new Error('mockNoodles: `data-permanent-noodles` marker not found in response HTML')
      }
      if (!original.includes(taglineAnchor)) {
        throw new Error('mockNoodles: `#intro-header-tagline` marker not found in response HTML')
      }

      const placeholders = noodlePlaceholders([...active, ...permanent])

      const body = original
        .replace(activeRegex, `data-active-noodles="${htmlAttrEncode(activeJson)}"`)
        .replace(permanentRegex, `data-permanent-noodles="${htmlAttrEncode(permanentJson)}"`)
        .replace(taglineAnchor, `${placeholders}${taglineAnchor}`)

      await route.fulfill({ response, body })
    },
  )
}

const TEST_TIME = new Date('2099-06-15T12:00:00Z')
const TEST_DATE = '2099-06-15'

test.describe('LandingIntroHeader onPrehydrate noodle', () => {
  test.use({ timezoneId: 'UTC' })

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(TEST_TIME)
  })

  test.describe('default behavior', () => {
    test('no permanent or active match → default logo and tagline visible', async ({
      page,
      goto,
    }) => {
      await mockNoodles(page, {
        active: [{ key: 'test-active', date: '2099-06-12' }],
        permanent: [{ key: 'test-permanent', tagline: false }],
      })

      await goto('/', { waitUntil: 'hydration' })

      await expect(page.locator('#intro-header-noodle-default')).toBeVisible()
      await expect(page.locator('#intro-header-noodle-test-permanent')).toBeHidden()
      await expect(page.locator('#intro-header-noodle-test-active')).toBeHidden()
      await expect(page.locator('#intro-header-tagline')).toBeVisible()
    })
  })

  test.describe('permanent noodles', () => {
    test('matching query swaps in the noodle and hides the tagline (opt-out)', async ({
      page,
      goto,
    }) => {
      await mockNoodles(page, {
        permanent: [{ key: 'test-permanent', tagline: false }],
        active: [],
      })

      await goto('/?test-permanent', { waitUntil: 'hydration' })

      await expect(page.locator('#intro-header-noodle-test-permanent')).toBeVisible()
      await expect(page.locator('#intro-header-noodle-default')).toBeHidden()
      await expect(page.locator('#intro-header-tagline')).toBeHidden()
    })
  })

  test.describe('active noodles', () => {
    test('exact date match → noodle visible, tagline visible', async ({ page, goto }) => {
      await mockNoodles(page, {
        active: [{ key: 'test-active', date: TEST_DATE, timezone: 'UTC' }],
      })

      await goto('/', { waitUntil: 'hydration' })

      await expect(page.locator('#intro-header-noodle-test-active')).toBeVisible()
      await expect(page.locator('#intro-header-noodle-default')).toBeHidden()
      await expect(page.locator('#intro-header-tagline')).toBeVisible()
    })

    test('current date inside [date, dateTo] range → noodle visible', async ({ page, goto }) => {
      await mockNoodles(page, {
        active: [{ key: 'test-active', date: '2099-06-14', dateTo: '2099-06-16', timezone: 'UTC' }],
      })

      await goto('/', { waitUntil: 'hydration' })

      await expect(page.locator('#intro-header-noodle-test-active')).toBeVisible()
      await expect(page.locator('#intro-header-noodle-default')).toBeHidden()
    })
  })

  test.describe('noodles in different timezone', () => {
    test('explicit timezone shifts current date forward (UTC late night → next day in JST)', async ({
      page,
      goto,
    }) => {
      // 2099-06-15T22:00Z is 2099-06-16 07:00 in Asia/Tokyo (UTC+9)
      await page.clock.setFixedTime(new Date('2099-06-15T22:00:00Z'))
      await mockNoodles(page, {
        active: [{ key: 'test-active', date: '2099-06-16', timezone: 'Asia/Tokyo' }],
      })

      await goto('/', { waitUntil: 'hydration' })

      await expect(page.locator('#intro-header-noodle-test-active')).toBeVisible()
      await expect(page.locator('#intro-header-noodle-default')).toBeHidden()
    })
  })
})

test.describe('LandingIntroHeader onPrehydrate noodle — non-UTC browser timezone', () => {
  test.use({ timezoneId: 'America/Los_Angeles' })

  test('timezone "auto" follows the browser timezone (UTC early morning → previous day in LA)', async ({
    page,
    goto,
  }) => {
    // 2099-06-15T05:00Z is 2099-06-14 22:00 in America/Los_Angeles (UTC-7 DST)
    await page.clock.setFixedTime(new Date('2099-06-15T05:00:00Z'))
    await mockNoodles(page, {
      active: [{ key: 'test-active', date: '2099-06-14', timezone: 'auto' }],
    })

    await goto('/', { waitUntil: 'hydration' })

    await expect(page.locator('#intro-header-noodle-test-active')).toBeVisible()
    await expect(page.locator('#intro-header-noodle-default')).toBeHidden()
  })
})
