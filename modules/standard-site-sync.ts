import process from 'node:process'
import { createHash } from 'node:crypto'
import { defineNuxtModule, useNuxt, createResolver } from 'nuxt/kit'
import { safeParse } from 'valibot'
import { BlogPostSchema, type BlogPostFrontmatter } from '../shared/schemas/blog'
import { NPMX_SITE } from '../shared/utils/constants'
import { read } from 'gray-matter'
import { TID } from '@atproto/common'
import { PasswordSession } from '@atproto/lex-password-session'
import {
  Client,
  isAtIdentifierString,
  XrpcResponseError,
  type AtIdentifierString,
} from '@atproto/lex'
import * as com from '../shared/types/lexicons/com'
import * as site from '../shared/types/lexicons/site'

const syncedDocuments = new Map<string, string>()
const CLOCK_ID_THREE = 3
const MS_TO_MICROSECONDS = 1000
const ONE_DAY_MILLISECONDS = 86400000

type BlogPostDocument = Pick<
  BlogPostFrontmatter,
  'title' | 'date' | 'path' | 'tags' | 'draft' | 'description' | 'excerpt'
>

type DocumentToSync = { tid: string; document: site.standard.document.Main }

// TODO: Currently logging quite a lot, can remove some later if we want
/**
 * INFO: Performs all necessary steps to synchronize with atproto for blog uploads
 * All module setup logic is encapsulated in this file so as to make it available during nuxt build-time.
 */
export default defineNuxtModule({
  meta: { name: 'standard-site-sync' },
  async setup() {
    const nuxt = useNuxt()
    const { resolve } = createResolver(import.meta.url)
    const contentDir = resolve('../app/pages/blog')

    const config = getPDSConfig()
    if (!config) return

    const { pdsUrl, handle, password } = config

    // Skip auth during prepare phase (nuxt prepare, nuxt generate --prepare, etc)
    if (nuxt.options._prepare) return

    const pdsPublicClient = new Client({ service: pdsUrl })
    // If set we have a publication record to create
    const possiblePublication = await checkPublication(handle, pdsPublicClient)

    nuxt.hook('build:before', async () => {
      const { glob } = await import('tinyglobby')
      const files: string[] = await glob(`${contentDir}/**/*.md`)

      // INFO: Arbitrarily chosen concurrency limit, can be changed if needed
      const concurrencyLimit = 5
      let documentsToSync: DocumentToSync[] = []
      for (let i = 0; i < files.length; i += concurrencyLimit) {
        const batch = files.slice(i, i + concurrencyLimit)
        // Process files in parallel
        let results = await Promise.all(
          batch.map(file =>
            syncFile(file, NPMX_SITE, handle, pdsPublicClient).catch(error =>
              console.error(`[standard-site-sync] Error in ${file}:` + error),
            ),
          ),
        )
        // Filter out docs not needed to sync
        documentsToSync.push(...results.filter(r => r !== undefined))
      }

      if (possiblePublication || documentsToSync.length > 0) {
        try {
          const session = await PasswordSession.login({
            service: pdsUrl,
            identifier: handle,
            password: password,
          })
          const authenticatedClient = new Client(session)
          if (possiblePublication) {
            await authenticatedClient.create(
              site.standard.publication,
              possiblePublication.record,
              {
                rkey: possiblePublication.tid,
              },
            )
          }
          if (documentsToSync.length > 0) {
            await syncsiteStandardDocuments(authenticatedClient, documentsToSync)
          }
        } catch (error) {
          console.error(`[standard-site-sync] Error syncing records: ${error}`)
        }
      }
    })
  },
})

// Get config from env vars
function getPDSConfig():
  | { pdsUrl: string; handle: AtIdentifierString; password: string }
  | undefined {
  const pdsUrl = process.env.NPMX_PDS_URL
  if (!pdsUrl) {
    console.warn('[standard-site-sync] NPMX_PDS_URL not set, skipping sync')
    return
  }

  const handle = process.env.NPMX_IDENTIFIER
  const password = process.env.NPMX_APP_PASSWORD

  if (!handle || !password || !isAtIdentifierString(handle)) {
    console.warn('[standard-site-sync] NPMX_IDENTIFIER or NPMX_APP_PASSWORD not set, skipping sync')
    return
  }

  return {
    pdsUrl,
    handle,
    password,
  }
}

async function syncsiteStandardDocuments(client: Client, documentsToSync: DocumentToSync[]) {
  let currentCommit = await client.xrpc(com.atproto.sync.getLatestCommit, {
    params: {
      did: client.assertDid,
    },
  })

  let writes = documentsToSync.map(doc =>
    //this should be an .update but having issues with it, and the records are checked before creating
    com.atproto.repo.applyWrites.create.$build({
      rkey: doc.tid,
      value: doc.document,
      collection: site.standard.document.$nsid,
    }),
  )

  await client.xrpc(com.atproto.repo.applyWrites, {
    body: {
      repo: client.assertDid,
      writes,
      swapCommit: currentCommit.body.cid,
    },
  })

  console.log('[standard-site-sync] synced all new publications')
}

// Parse date from frontmatter, add file-path entropy for same-date collision resolution
function generateTID(dateString: string, filePath: string): string {
  let timestamp = new Date(dateString).getTime()

  // If date has no time component (exact midnight), add file-based entropy
  // This ensures unique TIDs when multiple posts share the same date
  if (timestamp % ONE_DAY_MILLISECONDS === 0) {
    // Hash the file path to generate deterministic microseconds offset
    const pathHash = createHash('md5').update(filePath).digest('hex')
    const offset = parseInt(pathHash.slice(0, 8), 16) % 1000000 // 0-999999 microseconds
    timestamp += offset
  }

  // Clock id(3) needs to be the same everytime to get the same TID from a timestamp
  return TID.fromTime(timestamp * MS_TO_MICROSECONDS, CLOCK_ID_THREE).str
}

// Schema expects 'path' & frontmatter provides 'slug'
function normalizeBlogFrontmatter(frontmatter: Record<string, unknown>): Record<string, unknown> {
  return {
    ...frontmatter,
    path: typeof frontmatter.slug === 'string' ? `/blog/${frontmatter.slug}` : frontmatter.path,
  }
}

// Keys are sorted to provide a more stable hash
function createContentHash(data: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(data, Object.keys(data as object).sort()))
    .digest('hex')
}

function buildATProtoDocument(siteUrl: string, data: BlogPostDocument) {
  return site.standard.document.$build({
    site: siteUrl as `${string}:${string}`,
    path: data.path,
    title: data.title,
    description: data.description ?? data.excerpt,
    tags: data.tags,
    publishedAt: new Date(data.date).toISOString(),
  })
}

/*
 * Loads a record to atproto and ensures uniqueness by checking the date the article is published
 * publishedAt is an id that does not change
 * Atomicity is enforced with upsert using publishedAt so we always update existing records instead of creating new ones
 * Clock id(3) provides a deterministic ID
 * WARN: DOES NOT CATCH ERRORS, THIS MUST BE HANDLED
 */
const syncFile = async (
  filePath: string,
  siteUrl: string,
  identifier: AtIdentifierString,
  pdsPublicClient: Client,
) => {
  const { data: frontmatter } = read(filePath)

  const normalizedFrontmatter = normalizeBlogFrontmatter(frontmatter)
  // formats dates to ISO string for records
  if (normalizedFrontmatter['date']) {
    const rawDate = normalizedFrontmatter['date']
    normalizedFrontmatter.date = new Date(
      rawDate instanceof Date ? rawDate : String(rawDate),
    ).toISOString()
  }

  const result = safeParse(BlogPostSchema, normalizedFrontmatter)
  if (!result.success) {
    console.warn(`[standard-site-sync] Validation failed for ${filePath}`, result.issues)
    return
  }

  const data = result.output

  // filter drafts
  if (data.draft) {
    if (process.env.DEBUG === 'true') {
      console.debug(`[standard-site-sync] Skipping draft: ${data.path}`)
    }
    return
  }

  const hash = createContentHash(data)

  if (syncedDocuments.get(data.path) === hash) {
    return
  }

  const tid = generateTID(data.date, filePath)

  let checkForBlogResult = await pdsPublicClient.xrpcSafe(com.atproto.repo.getRecord, {
    params: {
      rkey: tid,
      repo: identifier,
      collection: site.standard.document.$nsid,
    },
  })

  if (checkForBlogResult.success) {
    console.log(`[standard-site-sync]: ${data.title} is already synced`)
    // Every thing is synced can now return
    return
  }
  if (checkForBlogResult instanceof XrpcResponseError) {
    //Means it's not been uploaded and we can do that now
    if (checkForBlogResult.error === 'RecordNotFound') {
      const document = buildATProtoDocument(siteUrl, data)
      return { tid, document }
    }
  }
  // Was another error and need to log it
  console.error('[standard-site-sync]: Error syncing document', checkForBlogResult.error)
}

/**
 * Checks for a site.standard.publication. If not there returns one to create
 * @param identifier
 * @param pdsPublicClient
 * @returns
 */
const checkPublication = async (identifier: AtIdentifierString, pdsPublicClient: Client) => {
  // Using our release date as the tid for the publication
  const publicationTid = TID.fromTime(
    new Date('2026-03-03').getTime() * MS_TO_MICROSECONDS,
    CLOCK_ID_THREE,
  ).str

  //Check to see if we have a publication yet
  const publicationCheck = await pdsPublicClient.xrpcSafe(com.atproto.repo.getRecord, {
    params: {
      repo: identifier,
      collection: site.standard.publication.$nsid,
      rkey: publicationTid,
    },
  })

  if (publicationCheck.success) {
    // We have a publication record
    return
  }

  if (publicationCheck instanceof XrpcResponseError) {
    //Means it's not been uploaded and we can do that now
    if (publicationCheck.error === 'RecordNotFound') {
      return {
        tid: publicationTid,
        record: site.standard.publication.$build({
          name: 'npmx.dev',
          url: 'https://npmx.dev/blog',
          description: 'a fast, modern browser for the npm registry',
        }),
      }
    }
  }
  // Was another error and need to log it
  console.error('[standard-site-sync]: Error syncing document', publicationCheck.error)
  return
}
