import { expect, test } from './test-utils'

test.describe('Blog feeds', () => {
  test.describe('have alternate links and matching content types', () => {
    const feeds = [
      {
        name: 'RSS',
        contentType: 'application/rss+xml',
      },
      {
        name: 'Atom',
        contentType: 'application/atom+xml',
      },
    ]

    for (const feed of feeds) {
      test(feed.name, async ({ page, goto }) => {
        await goto('/blog', { waitUntil: 'domcontentloaded' })

        const locator = page.locator(`link[rel='alternate'][type='${feed.contentType}']`).first()
        await expect(locator).toHaveAttribute('href')

        const href = await locator.getAttribute('href')
        expect(href).not.toBeNull()

        if (typeof href !== 'string') {
          return
        }

        // href is an absolute link
        expect(href.slice(0, 16)).toBe('https://npmx.dev')

        const { contentType, corsHeader, body } = await page.evaluate(async feedHref => {
          // Fetch the same path as in the alternate link
          const url = feedHref.slice(16)
          const response = await fetch(url)
          return {
            contentType: response.headers.get('Content-Type'),
            corsHeader: response.headers.get('Access-Control-Allow-Origin'),
            body: await response.text(),
          }
        }, href)

        expect(contentType).toBe(feed.contentType)
        expect(body.length).toBeGreaterThan(0)
        // Make sure feeds are available to browser-based readers, see
        // https://www.blogsareback.com/guides/enable-cors
        expect(corsHeader).toBe('*')
      })
    }
  })
})
