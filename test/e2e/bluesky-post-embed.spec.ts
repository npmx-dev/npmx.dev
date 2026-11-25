import { expect, test } from './test-utils'

test.describe('Bluesky post embed', () => {
  test.use({ viewport: { width: 1280, height: 600 } })

  test('refreshes post counts once the embed scrolls into view', async ({ page, goto }) => {
    const requests: string[] = []
    await page.route('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts**', async route => {
      requests.push(route.request().url())
      await route.fulfill({
        json: {
          posts: [
            {
              uri: new URL(route.request().url()).searchParams.get('uris'),
              author: { did: 'did:plc:2gkh62xvzokhlf6li4ol3b3d', handle: 'danielroe.dev' },
              record: {
                text: 'Mock Bluesky post for CSP coverage.',
                createdAt: '2026-03-03T12:00:00.000Z',
              },
              likeCount: 1234,
            },
          ],
        },
      })
    })

    await goto('/blog/alpha-release', { waitUntil: 'hydration' })

    const embed = page.locator('article .not-prose').filter({ hasText: 'Mock Bluesky post' })
    await expect(embed).toContainText('42')
    expect(requests).toEqual([])

    await embed.scrollIntoViewIfNeeded()
    await expect(embed).toContainText('1234')
    expect(requests).toHaveLength(1)
  })
})
