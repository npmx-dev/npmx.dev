import { describe, expect, it } from 'vitest'
import routerOptions from '../../../app/router.options'

function createRoute(overrides: Record<string, unknown> = {}) {
  return {
    path: '/',
    hash: '',
    meta: {},
    ...overrides,
  } as any
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
      meta: { preserveScrollOnQuery: true },
    })
    const from = createRoute({
      path: '/compare',
      meta: { preserveScrollOnQuery: true },
    })

    expect(routerOptions.scrollBehavior(to, from, null)).toBe(false)
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
