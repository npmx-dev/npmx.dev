import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'
import { SESSION_HINT_COOKIE, SESSION_HINT_VALUE } from '#shared/utils/constants'
import { useAtproto } from '~/composables/atproto/useAtproto'
import {
  clearClientSessionHintCookie,
  hasSessionHintCookie,
  initSessionHintMigration,
} from '~/utils/atproto/session-hint'

const mockUser = {
  did: 'did:plc:alice123',
  handle: 'alice.bsky.social',
  pds: 'https://bsky.social',
}

let sessionGetHandler: () => unknown = () => null
let sessionDeleteHandler: () => unknown = () => 'Session cleared'

registerEndpoint('/api/auth/session', {
  method: 'GET',
  handler: () => sessionGetHandler(),
})

registerEndpoint('/api/auth/session', {
  method: 'DELETE',
  handler: () => sessionDeleteHandler(),
})

const mountedWrappers: VueWrapper[] = []

async function mountAtproto() {
  let state!: ReturnType<typeof useAtproto>

  const Harness = defineComponent({
    setup() {
      state = useAtproto()
      return () => h('div')
    },
  })

  const wrapper = await mountSuspended(Harness)
  mountedWrappers.push(wrapper)
  return { wrapper, state }
}

describe('useAtproto', () => {
  beforeEach(() => {
    clearNuxtData()
    clearClientSessionHintCookie()
    localStorage.clear()
    initSessionHintMigration()
    sessionGetHandler = () => null
    sessionDeleteHandler = () => 'Session cleared'
  })

  afterEach(() => {
    while (mountedWrappers.length > 0) {
      mountedWrappers.pop()?.unmount()
    }
    clearNuxtData()
    clearClientSessionHintCookie()
    localStorage.clear()
    initSessionHintMigration()
  })

  it('makes no session call for anonymous visitors without a hint cookie', async () => {
    const getSpy = vi.fn(() => null)
    sessionGetHandler = getSpy

    const { wrapper, state } = await mountAtproto()

    expect(getSpy).not.toHaveBeenCalled()
    expect(state.user.value).toBeUndefined()
    expect(state.pending.value).toBe(false)
    wrapper.unmount()
  })

  it('makes no session call on subsequent visits after fresh anonymous initialization', async () => {
    const getSpy = vi.fn(() => null)
    sessionGetHandler = getSpy

    localStorage.setItem('npmx-settings', JSON.stringify({ relativeDates: false }))
    initSessionHintMigration()

    const { wrapper } = await mountAtproto()

    expect(getSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('fetches /api/auth/session when the hint cookie is present', async () => {
    const getSpy = vi.fn(() => mockUser)
    sessionGetHandler = getSpy
    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    initSessionHintMigration()

    const { wrapper, state } = await mountAtproto()

    await vi.waitFor(() => {
      expect(state.user.value).toEqual(mockUser)
    })
    expect(getSpy).toHaveBeenCalledTimes(1)
    expect(hasSessionHintCookie()).toBe(true)
    wrapper.unmount()
  })

  it('clears a stale hint cookie after a null response and skips future calls', async () => {
    const getSpy = vi.fn(() => null)
    sessionGetHandler = getSpy
    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    initSessionHintMigration()

    const first = await mountAtproto()

    await vi.waitFor(() => {
      expect(getSpy).toHaveBeenCalledTimes(1)
      expect(hasSessionHintCookie()).toBe(false)
    })
    first.wrapper.unmount()

    clearNuxtData()
    initSessionHintMigration()
    const second = await mountAtproto()

    expect(getSpy).toHaveBeenCalledTimes(1)
    second.wrapper.unmount()
  })

  it('clears a stale hint cookie after a 401 response and skips future calls', async () => {
    const getSpy = vi.fn(() => {
      throw createError({ statusCode: 401, message: 'User needs to re authenticate' })
    })
    sessionGetHandler = getSpy
    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    initSessionHintMigration()

    const first = await mountAtproto()

    await vi.waitFor(() => {
      expect(getSpy).toHaveBeenCalledTimes(1)
      expect(hasSessionHintCookie()).toBe(false)
    })
    first.wrapper.unmount()

    clearNuxtData()
    initSessionHintMigration()
    const second = await mountAtproto()

    expect(getSpy).toHaveBeenCalledTimes(1)
    second.wrapper.unmount()
  })

  it('preserves the hint cookie on transient 500 errors', async () => {
    const getSpy = vi.fn(() => {
      throw createError({ statusCode: 500, message: 'Temporary failure' })
    })
    sessionGetHandler = getSpy
    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    initSessionHintMigration()

    const { wrapper, state } = await mountAtproto()

    await vi.waitFor(() => {
      expect(getSpy).toHaveBeenCalled()
      expect(state.pending.value).toBe(false)
    })
    expect(hasSessionHintCookie()).toBe(true)
    wrapper.unmount()
  })

  it('performs a one-time migration check for pre-deploy logged-in users without a hint cookie', async () => {
    const getSpy = vi.fn(() => mockUser)
    sessionGetHandler = getSpy

    localStorage.clear()
    localStorage.setItem('npmx-settings', JSON.stringify({ relativeDates: false }))
    expect(initSessionHintMigration()).toBe(true)

    const { wrapper, state } = await mountAtproto()

    await vi.waitFor(() => {
      expect(state.user.value).toEqual(mockUser)
    })
    expect(getSpy).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('npmx-auth-hint-migrated')).toBe('1')
    wrapper.unmount()
  })

  it('performs only one migration check for pre-deploy anonymous users', async () => {
    const getSpy = vi.fn(() => null)
    sessionGetHandler = getSpy

    localStorage.clear()
    localStorage.setItem('npmx-settings', JSON.stringify({ relativeDates: false }))
    expect(initSessionHintMigration()).toBe(true)

    const first = await mountAtproto()

    await vi.waitFor(() => {
      expect(getSpy).toHaveBeenCalledTimes(1)
      expect(localStorage.getItem('npmx-auth-hint-migrated')).toBe('1')
    })
    first.wrapper.unmount()

    clearNuxtData()
    expect(initSessionHintMigration()).toBe(false)
    const second = await mountAtproto()

    expect(getSpy).toHaveBeenCalledTimes(1)
    second.wrapper.unmount()
  })

  it('does not clear a hint cookie set while a migration check is in flight', async () => {
    let resolveSession!: (value: null) => void
    sessionGetHandler = () =>
      new Promise(resolve => {
        resolveSession = resolve
      })

    localStorage.clear()
    localStorage.setItem('npmx-settings', JSON.stringify({ relativeDates: false }))
    expect(initSessionHintMigration()).toBe(true)

    const { wrapper, state } = await mountAtproto()

    await vi.waitFor(() => {
      expect(resolveSession).toBeTypeOf('function')
    })

    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    resolveSession(null)

    await vi.waitFor(() => {
      expect(state.pending.value).toBe(false)
      expect(localStorage.getItem('npmx-auth-hint-migrated')).toBe('1')
    })
    expect(hasSessionHintCookie()).toBe(true)
    wrapper.unmount()
  })

  it('clears the hint cookie and user state on logout', async () => {
    const deleteSpy = vi.fn(() => 'Session cleared')
    sessionGetHandler = () => mockUser
    sessionDeleteHandler = deleteSpy
    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    initSessionHintMigration()

    const { wrapper, state } = await mountAtproto()

    await vi.waitFor(() => {
      expect(state.user.value).toEqual(mockUser)
    })

    await state.logout()

    expect(deleteSpy).toHaveBeenCalledTimes(1)
    expect(hasSessionHintCookie()).toBe(false)
    expect(state.user.value).toBeUndefined()
    wrapper.unmount()
  })

  it('clears client auth state when DELETE /api/auth/session returns 401', async () => {
    sessionGetHandler = () => mockUser
    sessionDeleteHandler = () => {
      throw createError({ statusCode: 401, message: 'User needs to re authenticate' })
    }
    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    initSessionHintMigration()

    const { wrapper, state } = await mountAtproto()

    await vi.waitFor(() => {
      expect(state.user.value).toEqual(mockUser)
    })

    await expect(state.logout()).resolves.toBeUndefined()
    expect(hasSessionHintCookie()).toBe(false)
    expect(state.user.value).toBeUndefined()
    expect(localStorage.getItem('npmx-auth-hint-migrated')).toBe('1')
    wrapper.unmount()
  })

  it('preserves client auth state and rejects when DELETE /api/auth/session fails with 500', async () => {
    sessionGetHandler = () => mockUser
    sessionDeleteHandler = () => {
      throw createError({ statusCode: 500, message: 'Temporary failure' })
    }
    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    initSessionHintMigration()

    const { wrapper, state } = await mountAtproto()

    await vi.waitFor(() => {
      expect(state.user.value).toEqual(mockUser)
    })

    await expect(state.logout()).rejects.toMatchObject({ statusCode: 500 })
    expect(hasSessionHintCookie()).toBe(true)
    expect(state.user.value).toEqual(mockUser)
    wrapper.unmount()
  })
})
