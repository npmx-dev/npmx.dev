import { describe, expect, it } from 'vite-plus/test'
import routerOptions from '../../../app/router.options'

type ScrollBehavior = NonNullable<typeof routerOptions.scrollBehavior>
type RouteArg = Parameters<ScrollBehavior>[0]

function createRoute(overrides: Partial<RouteArg> = {}) {
  return {
    path: '/',
    hash: '',
    query: {},
    meta: {},
    ...overrides,
  } as RouteArg
}

describe('router scrollBehavior', () => {
  it('restores saved position when available', () => {
    const savedPosition = { left: 12, top: 345 }

    expect(routerOptions.scrollBehavior(createRoute(), createRoute(), savedPosition)).toEqual(
      savedPosition,
    )
  })

  it('preserves scroll on query-only updates for pages that opt in', () => {
    const to = createRoute({
      path: '/compare',
      query: { packages: 'vue,nuxt', facets: 'downloads,license' },
      meta: { preserveScrollOnQuery: true },
    })
    const from = createRoute({
      path: '/compare',
      query: { packages: 'vue', facets: 'downloads' },
      meta: { preserveScrollOnQuery: true },
    })

    expect(routerOptions.scrollBehavior(to, from, null)).toBe(false)
  })

  it('does not preserve scroll on query-only updates without opt-in', () => {
    const to = createRoute({
      path: '/compare',
      query: { packages: 'vue,nuxt', facets: 'downloads,license' },
    })
    const from = createRoute({
      path: '/compare',
      query: { packages: 'vue', facets: 'downloads' },
    })

    expect(routerOptions.scrollBehavior(to, from, null)).toEqual({ left: 0, top: 0 })
  })

  it('scrolls to hash anchors', () => {
    const to = createRoute({
      hash: '#section-function',
      meta: { scrollMargin: 96 },
    })

    expect(routerOptions.scrollBehavior(to, createRoute(), null)).toEqual({
      el: '#section-function',
      behavior: 'smooth',
      top: 96,
    })
  })

  it('scrolls to top for regular navigations', () => {
    const to = createRoute({ path: '/compare', meta: { preserveScrollOnQuery: true } })
    const from = createRoute({ path: '/search' })

    expect(routerOptions.scrollBehavior(to, from, null)).toEqual({ left: 0, top: 0 })
  })
})
