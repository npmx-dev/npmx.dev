import { describe, expect, it } from 'vite-plus/test'
import * as v from 'valibot'
import { toDatetimeString, type UriString } from '@atproto/lex'
import * as dev from '#shared/types/lexicons/dev'
import { CollectionBodySchema } from '#shared/schemas/social'
import { parseSubjectRef } from '#shared/utils/collections'
import {
  COLLECTION_SUBJECT_REF,
  MAX_COLLECTION_ITEMS,
  PACKAGE_SUBJECT_REF,
} from '#shared/utils/constants'

const DID = 'did:plc:u5zp7npt5kpueado77kuihyz'
const RKEY = '3m5k5baifas2t'
const COLLECTION_URI = COLLECTION_SUBJECT_REF(DID, RKEY)

describe('parseSubjectRef', () => {
  it('parses unscoped and scoped package refs', () => {
    expect(parseSubjectRef(PACKAGE_SUBJECT_REF('zod'))).toEqual({
      kind: 'package',
      packageName: 'zod',
    })
    expect(parseSubjectRef(PACKAGE_SUBJECT_REF('@vitejs/plugin-vue'))).toEqual({
      kind: 'package',
      packageName: '@vitejs/plugin-vue',
    })
  })

  it('parses collection AT-URIs', () => {
    expect(parseSubjectRef(COLLECTION_URI)).toEqual({
      kind: 'collection',
      uri: COLLECTION_URI,
      did: DID,
      rkey: RKEY,
    })
  })

  it.each([
    ['empty package name', 'https://npmx.dev/package/'],
    ['versioned package URL', 'https://npmx.dev/package/zod/v/3.0.0'],
    ['npmjs.com URL', 'https://www.npmjs.com/package/zod'],
    ['handle instead of DID', `at://npmx.dev/dev.npmx.collection/${RKEY}`],
    ['other collection type', `at://${DID}/app.bsky.graph.list/${RKEY}`],
    ['random URI', 'https://example.com'],
  ])('rejects %s', (_, subjectRef) => {
    expect(parseSubjectRef(subjectRef)).toBeNull()
  })
})

const record = (items: Array<{ subjectRef: string; note?: string }>) => ({
  $type: dev.npmx.collection.$nsid,
  name: 'Arg parsers',
  items,
  createdAt: new Date().toISOString(),
})

describe('dev.npmx.collection lexicon', () => {
  it('accepts packages and nested collections', () => {
    const result = dev.npmx.collection.$safeValidate(
      record([
        { subjectRef: PACKAGE_SUBJECT_REF('commander'), note: 'The default' },
        { subjectRef: COLLECTION_URI },
      ]),
    )
    expect(result.success).toBe(true)
  })

  it('builds a record', () => {
    const built = dev.npmx.collection.$build({
      name: 'Arg parsers',
      items: [{ subjectRef: PACKAGE_SUBJECT_REF('commander') as UriString }],
      createdAt: toDatetimeString(new Date()),
    })
    expect(built.$type).toBe(dev.npmx.collection.$nsid)
  })

  it('rejects more than the maximum number of items', () => {
    const items = Array.from({ length: MAX_COLLECTION_ITEMS + 1 }, (_, i) => ({
      subjectRef: PACKAGE_SUBJECT_REF(`pkg-${i}`),
    }))
    expect(dev.npmx.collection.$safeValidate(record(items)).success).toBe(false)
  })

  it('keeps the largest valid collection under the 1MB record limit', () => {
    // Every field at its byte limit; JSON is larger than the CBOR a PDS stores
    const items = Array.from({ length: MAX_COLLECTION_ITEMS }, () => ({
      subjectRef: `https://npmx.dev/package/${'a'.repeat(300 - 25)}` as UriString,
      // 140 graphemes of 4 bytes each
      note: '😀'.repeat(140),
    }))
    const largest = { ...record(items), name: 'a'.repeat(64), description: 'a'.repeat(300) }
    expect(dev.npmx.collection.$safeValidate(largest).success).toBe(true)
    expect(new TextEncoder().encode(JSON.stringify(largest)).length).toBeLessThan(1_000_000)
  })

  it('rejects a subjectRef that is not a URI', () => {
    expect(dev.npmx.collection.$safeValidate(record([{ subjectRef: 'zod' }])).success).toBe(false)
  })

  it('rejects a missing name', () => {
    const { name: _, ...withoutName } = record([])
    expect(dev.npmx.collection.$safeValidate(withoutName).success).toBe(false)
  })
})

describe('CollectionBodySchema', () => {
  it('accepts a valid body', () => {
    const result = v.safeParse(CollectionBodySchema, {
      name: '  Arg parsers ',
      items: [{ subjectRef: PACKAGE_SUBJECT_REF('commander') }, { subjectRef: COLLECTION_URI }],
    })
    expect(result.success && result.output.name).toBe('Arg parsers')
  })

  it.each([
    ['blank name', { name: '   ', items: [] }],
    ['name over 64 graphemes', { name: 'a'.repeat(65), items: [] }],
    ['unknown subjectRef kind', { name: 'x', items: [{ subjectRef: 'https://example.com' }] }],
    [
      'note over 140 graphemes',
      { name: 'x', items: [{ subjectRef: PACKAGE_SUBJECT_REF('zod'), note: 'a'.repeat(141) }] },
    ],
    [
      'too many items',
      {
        name: 'x',
        items: Array.from({ length: MAX_COLLECTION_ITEMS + 1 }, () => ({
          subjectRef: PACKAGE_SUBJECT_REF('zod'),
        })),
      },
    ],
  ])('rejects %s', (_, body) => {
    expect(v.safeParse(CollectionBodySchema, body).success).toBe(false)
  })
})
