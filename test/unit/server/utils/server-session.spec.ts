import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import { createApp, eventHandler, toNodeListener } from 'h3'
import { afterAll, describe, expect, it, vi } from 'vite-plus/test'
import {
  clearSessionHintCookie,
  hasServerSessionCookie,
  setSessionHintCookie,
  useServerSession,
} from '#server/utils/server-session'
import { CACHE_MAX_AGE_ONE_DAY, SESSION_HINT_COOKIE } from '#shared/utils/constants'

vi.stubGlobal('useRuntimeConfig', () => ({
  sessionPassword: 'test-session-password-32-chars-long',
}))

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('server-session', () => {
  it('round-trips sealed session and hint cookies and clears both on logout', async () => {
    const user = {
      did: 'did:plc:alice123',
      handle: 'alice.bsky.social',
      pds: 'https://bsky.social',
    }

    const app = createApp().use(
      eventHandler(async event => {
        if (event.path === '/login') {
          const session = await useServerSession(event)
          await session.update({ public: user })
          setSessionHintCookie(event)
          return 'ok'
        }
        if (!hasServerSessionCookie(event)) return null
        const session = await useServerSession(event)
        if (event.path === '/logout') {
          await session.clear()
          clearSessionHintCookie(event)
          return 'ok'
        }
        return session.data.public ?? null
      }),
    )

    const server = createServer(toNodeListener(app))
    try {
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

      const anonymous = await fetch(origin)
      expect(anonymous.status).toBe(204)
      expect(anonymous.headers.getSetCookie()).toEqual([])

      const login = await fetch(`${origin}/login`)
      const cookies = login.headers.getSetCookie()
      const hint = cookies.find(value => value.startsWith(`${SESSION_HINT_COOKIE}=`))
      const sessionCookie = cookies.find(value => value.startsWith('h3='))

      expect(hint).toBeDefined()
      expect(hint).toContain(`${SESSION_HINT_COOKIE}=1`)
      expect(hint).toContain(`Max-Age=${CACHE_MAX_AGE_ONE_DAY * 179}`)
      expect(hint).toMatch(/Path=\//i)
      expect(hint).toMatch(/SameSite=Lax/i)
      expect(hint).not.toMatch(/HttpOnly/i)
      expect(sessionCookie).toBeDefined()
      expect(sessionCookie).toMatch(/HttpOnly/i)

      const cookieHeader = cookies.map(value => value.split(';')[0]).join('; ')
      const restored = await fetch(origin, { headers: { cookie: cookieHeader } })
      expect(await restored.json()).toEqual(user)

      const logout = await fetch(`${origin}/logout`, { headers: { cookie: cookieHeader } })
      const deletions = logout.headers.getSetCookie()
      expect(
        deletions.some(
          value => value.startsWith(`${SESSION_HINT_COOKIE}=;`) && /Max-Age=0/i.test(value),
        ),
      ).toBe(true)
      expect(deletions.some(value => value.startsWith('h3=;'))).toBe(true)
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve())),
      )
    }
  })
})
