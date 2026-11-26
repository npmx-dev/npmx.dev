import type { NPMXProfile, PackageLikeStatus, PublicPackageLikes } from '#shared/types/social'
import { http, HttpResponse } from 'msw'
import { SESSION_HINT_COOKIE, SESSION_HINT_VALUE } from '#shared/utils/constants'

export const mockProfileHandle = 'mock-steward'

export const mockProfile: NPMXProfile = {
  displayName: mockProfileHandle,
  description: 'Maintains small tools for package metadata, docs, and release workflows.',
  website: `https://github.com/${mockProfileHandle}`,
  handle: mockProfileHandle,
  recordExists: true,
}

const mockLikedPackages = ['https://npmx.dev/package/nuxt', 'https://npmx.dev/package/vitest']

function createMockAuthSession(handle: string) {
  return {
    did: `did:plc:${handle}`,
    handle,
    pds: 'https://bsky.social',
  }
}

export function mockProfileHandler(overrides: Partial<NPMXProfile> = {}) {
  return http.get(`/api/social/profile/${mockProfileHandle}`, () =>
    HttpResponse.json({
      ...mockProfile,
      ...overrides,
    }),
  )
}

export function mockProfileLikesHandler(likes = mockLikedPackages) {
  return http.get(`/api/social/profile/${mockProfileHandle}/likes`, () =>
    HttpResponse.json({
      cursor: null,
      likes,
    }),
  )
}

export const mockPackageLikesHandler = http.get('/api/social/likes/:pkg', ({ params }) => {
  const pkg = String(params.pkg)
  const packageLikesByName: Record<string, number | undefined> = {
    nuxt: 128,
    vitest: 96,
  }
  const response: PublicPackageLikes = {
    totalLikes: packageLikesByName[pkg] ?? 12,
    topLikedRank: null,
  }

  return HttpResponse.json(response)
})

export const mockPackageLikeStatusHandler = http.get('/api/social/like-status/:pkg', () => {
  const response: PackageLikeStatus = {
    userHasLiked: false,
  }

  return HttpResponse.json(response)
})

export function mockAuthSessionHandler(handle: string | null = null) {
  if (typeof document !== 'undefined') {
    document.cookie = handle
      ? `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
      : `${SESSION_HINT_COOKIE}=; Path=/; Max-Age=0`
  }

  return http.get('/api/auth/session', () =>
    HttpResponse.json(handle ? createMockAuthSession(handle) : null),
  )
}

export const mockUpdateProfileHandler = http.put(`/api/social/profile/${mockProfileHandle}`, () =>
  HttpResponse.text('ok'),
)
