import { http, HttpResponse } from 'msw'
import type { CollectionSummary, CollectionView } from '#shared/types/social'

export const mockCollectionHandle = 'mock-steward'
const mockCollectionDid = `did:plc:${mockCollectionHandle}`
export const mockCollectionRkey = '3m5k5baifas2a'

export const mockCollectionSummary: CollectionSummary = {
  uri: `at://${mockCollectionDid}/dev.npmx.collection/${mockCollectionRkey}`,
  cid: 'bafyreimockcid',
  did: mockCollectionDid,
  handle: mockCollectionHandle,
  rkey: mockCollectionRkey,
  name: 'Arg parsers',
  description: 'CLI argument parsers worth knowing, from batteries-included to tiny.',
  itemCount: 5,
  createdAt: '2026-11-01T00:00:00.000Z',
}

export const mockCollection: CollectionView = {
  ...mockCollectionSummary,
  likes: { total: 12, viewerHas: false },
  follows: { total: 5, viewerHas: false },
  items: [
    {
      kind: 'package',
      subjectRef: 'https://npmx.dev/package/commander',
      packageName: 'commander',
      resolved: true,
      note: 'The default choice. Mature and well documented.',
    },
    {
      kind: 'package',
      subjectRef: 'https://npmx.dev/package/citty',
      packageName: 'citty',
      resolved: true,
      note: 'Tiny and typed, from UnJS.',
    },
    {
      kind: 'package',
      subjectRef: 'https://npmx.dev/package/not-a-real-parser',
      packageName: 'not-a-real-parser',
      resolved: false,
    },
    {
      kind: 'collection',
      subjectRef: 'at://did:plc:other/dev.npmx.collection/3m5k5baifas2b',
      note: 'For prompts rather than flags.',
      collection: {
        ...mockCollectionSummary,
        did: 'did:plc:other',
        handle: 'other.dev',
        rkey: '3m5k5baifas2b',
        name: 'Interactive prompts',
        description: undefined,
        itemCount: 2,
      },
    },
  ],
}

export const mockCollectionHandler = http.get(`/api/social/collections/:identifier/:rkey`, () =>
  HttpResponse.json(mockCollection),
)

export const mockCollectionLikeHandlers = [
  http.post(`/api/social/collections/:identifier/:rkey/like`, () =>
    HttpResponse.json({ total: mockCollection.likes.total + 1, viewerHas: true }),
  ),
  http.delete(`/api/social/collections/:identifier/:rkey/like`, () =>
    HttpResponse.json({ total: mockCollection.likes.total, viewerHas: false }),
  ),
]

export const mockCollectionFollowHandlers = [
  http.post(`/api/social/collections/:identifier/:rkey/follow`, () =>
    HttpResponse.json({ total: mockCollection.follows.total + 1, viewerHas: true }),
  ),
  http.delete(`/api/social/collections/:identifier/:rkey/follow`, () =>
    HttpResponse.json({ total: mockCollection.follows.total, viewerHas: false }),
  ),
]
