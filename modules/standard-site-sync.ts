import process from 'node:process'
import { createHash } from 'node:crypto'
import { defineNuxtModule, useNuxt, createResolver } from 'nuxt/kit'
import { safeParse } from 'valibot'
import * as site from '../shared/types/lexicons/site'
import { PDSSessionSchema, type PDSSessionResponse } from '../shared/schemas/atproto'
import { BlogPostSchema, type BlogPostFrontmatter } from '../shared/schemas/blog'
import { NPMX_SITE } from '../shared/utils/constants'
import { read } from 'gray-matter'
import { TID } from '@atproto/common'
import { $fetch } from 'ofetch'

const syncedDocuments = new Map<string, string>()
const CLOCK_ID_THREE = 3
const MS_TO_MICROSECONDS = 1000

type PDSSession = Pick<PDSSessionResponse, 'did' | 'handle'> & {
  accessToken: string
}

type BlogPostDocument = Pick<
  BlogPostFrontmatter,
  'title' | 'date' | 'path' | 'tags' | 'draft' | 'description' | 'excerpt'
>

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

    let session: PDSSession

    // Login to get session
    try {
      session = await authenticatePDS(pdsUrl, handle, password)
      console.log(`[standard-site-sync] Logged in as ${session.handle} (${session.did})`)
    } catch (error) {
      console.error('[standard-site-sync] Authentication failed:', error)
      return
    }

    nuxt.hook('build:before', async () => {
      const { glob } = await import('tinyglobby')
      const files: string[] = await glob(`${contentDir}/**/*.md`)

      // INFO: Arbitrarily chosen concurrency limit, can be changed if needed
      const concurrencyLimit = 5
      for (let i = 0; i < files.length; i += concurrencyLimit) {
        const batch = files.slice(i, i + concurrencyLimit)
        // Process files in parallel
        await Promise.all(
          batch.map(file =>
            syncFile(file, NPMX_SITE, pdsUrl, session.accessToken, session.did).catch(error =>
              console.error(`[standard-site-sync] Error in ${file}:` + error),
            ),
          ),
        )
      }
    })

    nuxt.hook('builder:watch', async (event, path) => {
      if (!path.endsWith('.md')) return

      // Ignore deleted files
      if (event === 'unlink') {
        console.log(`[standard-site-sync] File deleted: ${path}`)
        return
      }

      // Process add/change events only
      await syncFile(
        resolve(nuxt.options.rootDir, path),
        NPMX_SITE,
        pdsUrl,
        session.accessToken,
        session.did,
      ).catch(err => console.error(`[standard-site-sync] Failed ${path}:`, err))
    })
  },
})

// Get config from env vars
function getPDSConfig(): { pdsUrl: string; handle: string; password: string } | undefined {
  const pdsUrl = process.env.NPMX_PDS_URL
  if (!pdsUrl) {
    console.warn('[standard-site-sync] NPMX_PDS_URL not set, skipping sync')
    return
  }

  // TODO: Update to better env var names for production
  const handle = process.env.NPMX_TEST_HANDLE
  const password = process.env.NPMX_TEST_PASSWORD

  if (!handle || !password) {
    console.warn(
      '[standard-site-sync] NPMX_TEST_HANDLE or NPMX_TEST_PASSWORD not set, skipping sync',
    )
    return
  }

  return {
    pdsUrl,
    handle,
    password,
  }
}

// Authenticate PDS with creds
async function authenticatePDS(
  pdsUrl: string,
  handle: string,
  password: string,
): Promise<PDSSession> {
  const sessionResponse = await $fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    body: { identifier: handle, password },
  })

  const result = safeParse(PDSSessionSchema, sessionResponse)
  if (!result.success) {
    throw new Error(`PDS response validation failed: ${result.issues[0].message}`)
  }

  return {
    accessToken: result.output.accessJwt,
    did: result.output.did,
    handle: result.output.handle,
  }
}

// Parse date from frontmatter, add file-path entropy for same-date collision resolution
function generateTID(dateString: string, filePath: string): string {
  let timestamp = new Date(dateString).getTime()

  // If date has no time component (exact midnight), add file-based entropy
  // This ensures unique TIDs when multiple posts share the same date
  if (timestamp % 86400000 === 0) {
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
  pdsUrl: string,
  accessToken: string,
  did: string,
) => {
  const { data: frontmatter } = read(filePath)

  const normalizedFrontmatter = normalizeBlogFrontmatter(frontmatter)

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

  const document = buildATProtoDocument(siteUrl, data)

  const tid = generateTID(data.date, filePath)

  await $fetch(`${pdsUrl}/xrpc/com.atproto.repo.putRecord`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      // Pass object directly, not JSON.stringify
      repo: did,
      collection: 'site.standard.document',
      rkey: tid,
      record: document,
    },
  })

  syncedDocuments.set(data.path, hash)
  console.log(`[standard-site-sync] Synced ${data.path} (rkey: ${tid})`)
}
