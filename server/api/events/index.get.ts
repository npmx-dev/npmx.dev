import { marked } from 'marked'
import type {
  EventDetail,
  EventKind,
  EventLink,
  EventMode,
  EventStatus,
  Speaker,
  Talk,
} from '~/types/events'

const NPMX_PDS_HOST = 'https://npmx.social'
const NPMX_EVENTS_DID = 'did:plc:u5zp7npt5kpueado77kuihyz'
const EVENT_COLLECTION = 'community.lexicon.calendar.event'
const TALK_COLLECTION = 'dev.npmx.calendar.talk'

interface RawBlobRef {
  ref?: { $link?: string }
  mimeType?: string
}

interface RawEvent {
  name: string
  description?: string
  mode?: string
  status?: string
  startsAt?: string
  endsAt?: string
  createdAt: string
  uris?: Array<{ uri: string; name?: string }>
  locations?: Array<{ uri?: string; name?: string }>
  media?: Array<{ role?: string; content?: RawBlobRef }>
  additionalData?: { attendeeCount?: number }
}

interface RawTalk {
  event?: { uri?: string }
  title: string
  abstract?: string
  speakers?: Array<{ name: string; handle?: string; did?: string }>
  startsAt?: string
  recording?: { uri?: string }
  slides?: { uri?: string }
}

interface ListRecordsResponse<T> {
  records: Array<{ uri: string; value: T }>
  cursor?: string
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function tokenTail(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const tail = value.split('#').pop()
  return tail || fallback
}

function blobUrl(did: string, ref?: RawBlobRef): string | undefined {
  const cid = ref?.ref?.$link
  if (!cid) return undefined
  return `${NPMX_PDS_HOST}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`
}

function stripGuildNote(raw?: string): string | undefined {
  if (!raw) return undefined
  const text = raw.trim()
  if (!text.startsWith('>')) return text || undefined
  const split = text.indexOf('\n\n')
  return (split === -1 ? '' : text.slice(split + 2)).trim() || undefined
}

function toPlainText(md?: string): string | undefined {
  if (!md) return undefined
  const text = md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/[*_`]/g, '')
    .trim()
  return text || undefined
}

function renderMarkdown(md?: string): string | undefined {
  if (!md) return undefined
  const html = marked.parse(md, { async: false, breaks: true }) as string
  return (
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '')
      .replace(
        /<a href="(https?:\/\/[^"]+)">/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">',
      )
      .trim() || undefined
  )
}

function mapTalk(uri: string, value: RawTalk): Talk {
  const speakers: Speaker[] = (value.speakers ?? []).map(s => ({
    name: s.name,
    handle: s.handle,
    did: s.did,
  }))

  return {
    id: uri.split('/').pop() || uri,
    title: value.title,
    abstract: value.abstract,
    speakers,
    startsAt: value.startsAt,
    watchUrl: value.recording?.uri,
    slidesUrl: value.slides?.uri,
  }
}

function mapEvent(did: string, value: RawEvent, talks: Talk[]): EventDetail {
  const uris = value.uris ?? []
  const links: EventLink[] = uris.map(u => ({ uri: u.uri, name: u.name }))
  const registerUrl = uris.find(u => u.uri.includes('guild.host'))?.uri
  const cover = blobUrl(did, value.media?.find(m => m.role === 'thumbnail')?.content)
  const rawDescription = stripGuildNote(value.description)

  return {
    slug: slugify(value.name),
    name: value.name,
    description: toPlainText(rawDescription),
    descriptionHtml: renderMarkdown(rawDescription),
    kind: 'meetup' as EventKind,
    mode: tokenTail(value.mode, 'inperson') as EventMode,
    status: tokenTail(value.status, 'scheduled') as EventStatus,
    startsAt: value.startsAt ?? value.createdAt,
    endsAt: value.endsAt,
    cover,
    tags: [],
    attendees: [],
    attendeeCount: value.additionalData?.attendeeCount ?? 0,
    hosts: [],
    links,
    registerUrl,
    talks,
  }
}

async function listRecords<T>(collection: string): Promise<ListRecordsResponse<T>['records']> {
  const records: ListRecordsResponse<T>['records'] = []
  let cursor: string | undefined

  do {
    const url = new URL(`${NPMX_PDS_HOST}/xrpc/com.atproto.repo.listRecords`)
    url.searchParams.set('repo', NPMX_EVENTS_DID)
    url.searchParams.set('collection', collection)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)

    const response = await fetch(url.toString())
    if (!response.ok) {
      throw createError({ statusCode: 502, message: 'Failed to load events from the npmx PDS' })
    }

    const data = (await response.json()) as ListRecordsResponse<T>
    records.push(...data.records)
    cursor = data.records.length === 100 ? data.cursor : undefined
  } while (cursor)

  return records
}

export default defineEventHandler(async event => {
  const [eventRecords, talkRecords] = await Promise.all([
    listRecords<RawEvent>(EVENT_COLLECTION),
    listRecords<RawTalk>(TALK_COLLECTION),
  ])

  const talksByEvent = new Map<string, Talk[]>()
  for (const record of talkRecords) {
    const eventUri = record.value.event?.uri
    if (!eventUri) continue
    const talk = mapTalk(record.uri, record.value)
    const list = talksByEvent.get(eventUri)
    if (list) list.push(talk)
    else talksByEvent.set(eventUri, [talk])
  }

  const events = eventRecords
    .map(record => mapEvent(NPMX_EVENTS_DID, record.value, talksByEvent.get(record.uri) ?? []))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))

  setHeader(event, 'cache-control', 's-maxage=300, stale-while-revalidate=3600')
  return events
})
