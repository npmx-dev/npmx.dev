import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it, vi } from 'vite-plus/test'

vi.stubGlobal('defineNuxtConfig', <T>(config: T) => config)

const { default: config } = await import('../../../nuxt.config')

interface ISRRule {
  expiration?: number | false
  passQuery?: boolean
  allowQuery?: string[]
}

const routeRules = config.routeRules as Record<string, { isr?: boolean | number | ISRRule }>
const rootDir = join(import.meta.dirname, '../../..')

const QUERY_HANDLERS: Record<string, { rule: string; query: string[] }> = {
  'server/api/atproto/bluesky-author-profiles.get.ts': {
    rule: '/api/atproto/bluesky-author-profiles',
    query: ['authors'],
  },
  'server/api/atproto/bluesky-comments.get.ts': {
    rule: '/api/atproto/bluesky-comments',
    query: ['uri'],
  },
  'server/api/auth/atproto.get.ts': { rule: '/api/auth/**', query: [] },
  'server/api/changelog/md/[provider]/[owner]/[repo]/[...path].get.ts': {
    rule: '/api/changelog/md/**',
    query: ['host', 'raw'],
  },
  'server/api/changelog/releases/[provider]/[owner]/[repo].get.ts': {
    rule: '/api/changelog/releases/**',
    query: ['host'],
  },
  'server/api/changelog/releases/[provider]/[owner]/[repo]/raw/[tag].get.ts': {
    rule: '/api/changelog/releases/**',
    query: ['host'],
  },
  'server/api/embed/downloads.svg.get.ts': {
    rule: '/api/embed/downloads.svg',
    query: [
      'packages',
      'package',
      'metric',
      'startDate',
      'start',
      'endDate',
      'end',
      'mode',
      'granularity',
      'locale',
      'accent',
      'yLabel',
      'width',
      'height',
      'weeks',
      'months',
    ],
  },
  'server/api/opensearch/suggestions.get.ts': { rule: '/api/opensearch/suggestions', query: ['q'] },
  'server/api/registry/badge/[type]/[...pkg].get.ts': {
    rule: '/api/registry/badge/**',
    query: ['color', 'labelColor', 'label', 'name', 'style', 'value'],
  },
  'server/api/registry/compare-file/[...pkg].get.ts': {
    rule: '/api/registry/compare-file/**',
    query: ['mergeModifiedLines', 'maxChangeRatio', 'maxDiffDistance', 'inlineMaxCharEdits'],
  },
  'server/api/registry/downloads/[...slug].get.ts': {
    rule: '/api/registry/downloads/**',
    query: ['mode', 'filterOldVersions', 'filterThreshold', 'packages'],
  },
  'server/api/registry/image-proxy/index.get.ts': {
    rule: '/api/registry/image-proxy',
    query: ['url', 'sig'],
  },
  'server/api/registry/install-size/[...pkg].get.ts': {
    rule: '/api/registry/install-size/**',
    query: ['frozen-history'],
  },
  'server/api/registry/license-change/[...pkg].get.ts': {
    rule: '/api/registry/license-change/**',
    query: ['version'],
  },
  'server/api/registry/packument/[...pkg].get.ts': {
    rule: '/api/registry/packument/**',
    query: ['version'],
  },
  'server/api/registry/timeline/[...pkg].get.ts': {
    rule: '/api/registry/timeline/**',
    query: ['offset', 'limit', 'sort', 'stable-only', 'around'],
  },
  'server/api/registry/timeline/sizes/[...pkg].get.ts': {
    rule: '/api/registry/timeline/**',
    query: ['offset', 'limit', 'sort', 'stable-only', 'frozen-history'],
  },
  'server/api/social/profile/[identifier]/likes.get.ts': { rule: '/api/social/**', query: [] },
}

const queryByRule: Record<string, Set<string>> = {}
for (const { rule, query } of Object.values(QUERY_HANDLERS)) {
  queryByRule[rule] = new Set([...(queryByRule[rule] ?? []), ...query])
}

const UNCHECKED_ISR_ROUTES = new Set(['/api/registry/docs/**'])

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

describe('route rules', () => {
  it('lists every server handler that reads the query string', () => {
    const handlers = ['server/api', 'server/routes']
      .flatMap(dir => listFiles(join(rootDir, dir)))
      .filter(file => readFileSync(file, 'utf-8').includes('getQuery('))
      .map(file => relative(rootDir, file).replaceAll('\\', '/'))
      .sort()

    expect(handlers).toEqual(Object.keys(QUERY_HANDLERS).sort())
  })

  it('limits the isr cache key of every cached route to the query params it reads', () => {
    const unbounded = Object.entries(routeRules)
      .filter(
        ([route, { isr }]) =>
          isr !== undefined && isr !== false && !UNCHECKED_ISR_ROUTES.has(route),
      )
      .filter(([, { isr }]) => typeof isr !== 'object' || !Array.isArray(isr.allowQuery))
      .map(([route]) => route)

    expect(unbounded).toEqual([])
  })

  it.each(Object.entries(queryByRule))(
    'caches %s by exactly the query params its handlers read',
    (rule, query) => {
      const isr = routeRules[rule]?.isr
      if (isr === false) return

      expect(isr).toMatchObject({ passQuery: true })
      expect([...(isr as ISRRule).allowQuery!].sort()).toEqual([...query].sort())
    },
  )
})
