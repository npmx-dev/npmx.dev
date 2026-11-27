import { expect, test } from './test-utils'

test.describe('Public package likes caching', () => {
  test('returns cacheable public likes regardless of request credentials', async ({
    page,
    baseURL,
  }) => {
    const bodies: unknown[] = []

    const requestHeaders: Array<Record<string, string>> = [
      {},
      {
        Cookie: 'h3=invalid-session; npmx_logged_in=1',
        Authorization: 'Bearer invalid-token',
      },
    ]

    for (const headers of requestHeaders) {
      const response = await page.request.get(
        new URL('/api/social/likes/vue', baseURL).toString(),
        {
          headers,
        },
      )
      expect(response.status()).toBe(200)

      const responseHeaders = response.headers()
      expect(responseHeaders['cache-control']).toBe(
        'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
      )
      expect(responseHeaders['set-cookie']).toBeUndefined()
      expect(responseHeaders.vary).toBeUndefined()

      const body = await response.json()
      expect(Object.keys(body).sort()).toEqual(['topLikedRank', 'totalLikes'])
      expect(typeof body.totalLikes).toBe('number')
      bodies.push(body)
    }

    expect(bodies[1]).toEqual(bodies[0])
  })

  test('marks per-user like status as private and uncacheable', async ({ page, baseURL }) => {
    const response = await page.request.get(
      new URL('/api/social/like-status/vue', baseURL).toString(),
    )
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toBe('private, no-store')
    expect(await response.json()).toEqual({ userHasLiked: false })
  })

  test('anonymous package view fetches public likes and skips per-user like status', async ({
    page,
    goto,
  }) => {
    let publicLikesRequests = 0
    let likeStatusRequests = 0

    page.on('request', req => {
      const url = new URL(req.url())
      if (url.pathname === '/api/social/likes/nuxt') {
        publicLikesRequests++
      }
      if (url.pathname.startsWith('/api/social/like-status/')) {
        likeStatusRequests++
      }
    })

    await goto('/package/nuxt', { waitUntil: 'hydration' })
    await expect.poll(() => publicLikesRequests).toBe(1)
    expect(likeStatusRequests).toBe(0)
  })
})
