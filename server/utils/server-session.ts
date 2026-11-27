import type { H3Event } from 'h3'
import type { UserServerSession } from '#shared/types/userSession'
import { deleteCookie, getCookie, getHeader, setCookie, useSession } from 'h3'
import {
  CACHE_MAX_AGE_ONE_DAY,
  SESSION_HINT_COOKIE,
  SESSION_HINT_VALUE,
} from '#shared/utils/constants'

const SERVER_SESSION_COOKIE = 'h3'
const SERVER_SESSION_HEADER = 'x-h3-session'
const SESSION_MAX_AGE = CACHE_MAX_AGE_ONE_DAY * 179

function getSessionHintCookieOptions() {
  return {
    httpOnly: false,
    secure: !import.meta.dev && !import.meta.test,
    sameSite: 'lax' as const,
    path: '/',
  }
}

export function hasServerSessionCookie(event: H3Event): boolean {
  return Boolean(getCookie(event, SERVER_SESSION_COOKIE) || getHeader(event, SERVER_SESSION_HEADER))
}

export function setSessionHintCookie(event: H3Event): void {
  setCookie(event, SESSION_HINT_COOKIE, SESSION_HINT_VALUE, {
    ...getSessionHintCookieOptions(),
    maxAge: SESSION_MAX_AGE,
  })
}

export function clearSessionHintCookie(event: H3Event): void {
  deleteCookie(event, SESSION_HINT_COOKIE, getSessionHintCookieOptions())
}

export const useServerSession = async (event: H3Event) => {
  const config = useRuntimeConfig(event)

  if (!config.sessionPassword) {
    throw new Error('Session password is not configured')
  }

  const serverSession = await useSession<UserServerSession>(event, {
    password: config.sessionPassword,
    maxAge: SESSION_MAX_AGE,
  })

  return serverSession
}
