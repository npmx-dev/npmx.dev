import * as v from 'valibot'
import { SPACEDUST_HOST, UFOS_API_HOST } from '#shared/utils/constants'

export const PACKAGE_LIKE_COLLECTION = 'dev.npmx.feed.like'
export const SPACEDUST_PACKAGE_LIKE_SOURCE = `${PACKAGE_LIKE_COLLECTION}:subjectRef`
export const RECENT_PACKAGE_LIKES_LIMIT = 5

const SpacedustPackageLikeEventSchema = v.object({
  kind: v.literal('link'),
  origin: v.optional(v.literal('live')),
  link: v.object({
    operation: v.literal('create'),
    source: v.literal(SPACEDUST_PACKAGE_LIKE_SOURCE),
    source_record: v.optional(v.string()),
    subject: v.string(),
  }),
})

const UfosPackageLikeRecordSchema = v.object({
  did: v.string(),
  collection: v.literal(PACKAGE_LIKE_COLLECTION),
  rkey: v.string(),
  record: v.object({
    createdAt: v.optional(v.string()),
    subjectRef: v.string(),
  }),
  time_us: v.optional(v.number()),
})

const UfosPackageLikeRecordsSchema = v.array(UfosPackageLikeRecordSchema)

export type RecentPackageLikeOrigin = 'live' | 'recent'

export type RecentPackageLike = {
  id: string
  packageName: string
  origin: RecentPackageLikeOrigin
  subjectRef: string
  likedAt: number
  packageDescription?: string | null
  weeklyDownloads?: number | null
  repositoryStars?: number | null
  animateEntry?: boolean
}

export function createPackageLikesStreamUrl(): string {
  const url = new URL(`wss://${SPACEDUST_HOST}/subscribe`)
  url.searchParams.set('instant', 'true')
  url.searchParams.append('wantedSources', SPACEDUST_PACKAGE_LIKE_SOURCE)
  return url.toString()
}

export function createPackageLikesSeedUrl(): string {
  const url = new URL(`https://${UFOS_API_HOST}/records`)
  url.searchParams.set('collection', PACKAGE_LIKE_COLLECTION)
  return url.toString()
}

export function packageNameFromSubjectRef(subjectRef: string): string | null {
  if (!URL.canParse(subjectRef)) return null
  const url = new URL(subjectRef)

  if (url.origin !== 'https://npmx.dev') return null

  const packagePathPrefix = '/package/'
  if (!url.pathname.startsWith(packagePathPrefix)) return null

  const packageName = url.pathname.slice(packagePathPrefix.length)
  if (!packageName) return null

  try {
    return decodeURIComponent(packageName)
  } catch {
    return packageName
  }
}

function likedAtFromUfosRecord(record: v.InferOutput<typeof UfosPackageLikeRecordSchema>): number {
  const createdAt = record.record.createdAt ? Date.parse(record.record.createdAt) : NaN
  if (Number.isFinite(createdAt)) return createdAt
  if (record.time_us !== undefined) return Math.floor(record.time_us / 1000)
  return Date.now()
}

export function parseSpacedustPackageLikeEvent(
  payload: unknown,
  likedAt: number = Date.now(),
): RecentPackageLike | null {
  const parsedPayload = v.safeParse(SpacedustPackageLikeEventSchema, payload)
  if (!parsedPayload.success) return null

  const { subject, source_record: sourceRecord } = parsedPayload.output.link
  const packageName = packageNameFromSubjectRef(subject)
  if (!packageName) return null

  return {
    id: sourceRecord ?? `${subject}:${likedAt}`,
    packageName,
    origin: 'live',
    subjectRef: subject,
    likedAt,
  }
}

export function parseUfosPackageLikeRecords(payload: unknown): RecentPackageLike[] {
  const parsedPayload = v.safeParse(UfosPackageLikeRecordsSchema, payload)
  if (!parsedPayload.success) return []

  return parsedPayload.output.flatMap((record): RecentPackageLike[] => {
    const packageName = packageNameFromSubjectRef(record.record.subjectRef)
    if (!packageName) return []

    return [
      {
        id: `at://${record.did}/${record.collection}/${record.rkey}`,
        packageName,
        origin: 'recent',
        subjectRef: record.record.subjectRef,
        likedAt: likedAtFromUfosRecord(record),
      },
    ]
  })
}
