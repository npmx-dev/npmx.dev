import { describe, expect, it } from 'vitest'
import {
  SPACEDUST_PACKAGE_LIKE_SOURCE,
  createPackageLikesSeedUrl,
  createPackageLikesStreamUrl,
  packageNameFromSubjectRef,
  parseSpacedustPackageLikeEvent,
  parseUfosPackageLikeRecords,
} from '~/utils/recent-package-likes'

describe('createPackageLikesStreamUrl', () => {
  it('connects to the filtered Spacedust package-like stream', () => {
    const url = new URL(createPackageLikesStreamUrl())

    expect(url.protocol).toBe('wss:')
    expect(url.host).toBe('spacedust.microcosm.blue')
    expect(url.pathname).toBe('/subscribe')
    expect(url.searchParams.get('instant')).toBe('true')
    expect(url.searchParams.getAll('wantedSources')).toEqual([SPACEDUST_PACKAGE_LIKE_SOURCE])
  })
})

describe('createPackageLikesSeedUrl', () => {
  it('connects to the UFOs recent package-like records feed', () => {
    const url = new URL(createPackageLikesSeedUrl())

    expect(url.protocol).toBe('https:')
    expect(url.host).toBe('ufos-api.microcosm.blue')
    expect(url.pathname).toBe('/records')
    expect(url.searchParams.get('collection')).toBe('dev.npmx.feed.like')
  })
})

describe('packageNameFromSubjectRef', () => {
  it('extracts package names from npmx package subject refs', () => {
    expect(packageNameFromSubjectRef('https://npmx.dev/package/vue')).toBe('vue')
    expect(packageNameFromSubjectRef('https://npmx.dev/package/@nuxt/kit')).toBe('@nuxt/kit')
    expect(packageNameFromSubjectRef('https://example.com/package/vue')).toBeNull()
  })
})

describe('parseSpacedustPackageLikeEvent', () => {
  it('parses Spacedust create events for package likes', () => {
    expect(
      parseSpacedustPackageLikeEvent(
        {
          kind: 'link',
          origin: 'live',
          link: {
            operation: 'create',
            source: SPACEDUST_PACKAGE_LIKE_SOURCE,
            source_record: 'at://did:plc:test/dev.npmx.feed.like/3mtest',
            source_rev: '3mtest',
            subject: 'https://npmx.dev/package/vue',
          },
        },
        123,
      ),
    ).toEqual({
      id: 'at://did:plc:test/dev.npmx.feed.like/3mtest',
      packageName: 'vue',
      origin: 'live',
      subjectRef: 'https://npmx.dev/package/vue',
      likedAt: 123,
    })
  })

  it('ignores deletes, other link sources, non-package links, and non-live origins', () => {
    expect(
      parseSpacedustPackageLikeEvent({
        kind: 'link',
        link: {
          operation: 'delete',
          source: SPACEDUST_PACKAGE_LIKE_SOURCE,
          subject: 'https://npmx.dev/package/vue',
        },
      }),
    ).toBeNull()

    expect(
      parseSpacedustPackageLikeEvent({
        kind: 'link',
        link: {
          operation: 'create',
          source: 'app.bsky.graph.follow:subject',
          subject: 'https://npmx.dev/package/vue',
        },
      }),
    ).toBeNull()

    expect(
      parseSpacedustPackageLikeEvent({
        kind: 'link',
        link: {
          operation: 'create',
          source: SPACEDUST_PACKAGE_LIKE_SOURCE,
          subject: 'https://example.com/package/vue',
        },
      }),
    ).toBeNull()

    expect(
      parseSpacedustPackageLikeEvent({
        kind: 'link',
        origin: 'batch',
        link: {
          operation: 'create',
          source: SPACEDUST_PACKAGE_LIKE_SOURCE,
          subject: 'https://npmx.dev/package/vue',
        },
      }),
    ).toBeNull()

    expect(
      parseSpacedustPackageLikeEvent({
        kind: 'link',
        origin: 'replay',
        link: {
          operation: 'create',
          source: SPACEDUST_PACKAGE_LIKE_SOURCE,
          subject: 'https://npmx.dev/package/vue',
        },
      }),
    ).toBeNull()

    expect(
      parseSpacedustPackageLikeEvent({
        kind: 'link',
        origin: 'backfill',
        link: {
          operation: 'create',
          source: SPACEDUST_PACKAGE_LIKE_SOURCE,
          subject: 'https://npmx.dev/package/@nuxt/kit',
        },
      }),
    ).toBeNull()
  })
})

describe('parseUfosPackageLikeRecords', () => {
  it('parses UFOs recent package like records for the startup seed', () => {
    expect(
      parseUfosPackageLikeRecords([
        {
          did: 'did:plc:test',
          collection: 'dev.npmx.feed.like',
          rkey: '3mtest',
          record: {
            $type: 'dev.npmx.feed.like',
            createdAt: '2026-05-09T12:28:11.127Z',
            subjectRef: 'https://npmx.dev/package/@tanstack/solid-start',
          },
          time_us: 1778329691492023,
        },
        {
          did: 'did:plc:test',
          collection: 'dev.npmx.feed.like',
          rkey: '3mignored',
          record: {
            $type: 'dev.npmx.feed.like',
            subjectRef: 'https://example.com/package/vue',
          },
        },
      ]),
    ).toEqual([
      {
        id: 'at://did:plc:test/dev.npmx.feed.like/3mtest',
        packageName: '@tanstack/solid-start',
        origin: 'recent',
        subjectRef: 'https://npmx.dev/package/@tanstack/solid-start',
        likedAt: Date.parse('2026-05-09T12:28:11.127Z'),
      },
    ])
  })
})
