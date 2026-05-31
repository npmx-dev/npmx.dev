import type { H3Event } from 'h3'
import * as v from 'valibot'
import type { CachedFetchFunction } from '#shared/utils/fetch-cache-config'
import { isAllowedImageUrl, toProxiedImageUrl } from '#server/utils/image-proxy'
import { fetchNpmPackage } from '#server/utils/npm'
import { CACHE_MAX_AGE_ONE_DAY, MICROLINK_API } from '#shared/utils/constants'

const MICROLINK_FETCH_TIMEOUT_MS = 1500

const MicrolinkAssetSchema = v.object({
  url: v.string(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
})

const MicrolinkResponseSchema = v.object({
  data: v.object({
    image: v.optional(v.nullable(MicrolinkAssetSchema)),
    logo: v.optional(v.nullable(MicrolinkAssetSchema)),
  }),
})

export type HomepageMetadata = {
  homepageUrl: string | null
  homepagePreviewUrl: string | null
  homepagePreviewWidth: number | null
  homepagePreviewHeight: number | null
  homepageLogoUrl: string | null
  homepageLogoWidth: number | null
  homepageLogoHeight: number | null
}

export function emptyHomepageMetadata(homepageUrl: string | null = null): HomepageMetadata {
  return {
    homepageUrl,
    homepagePreviewUrl: null,
    homepagePreviewWidth: null,
    homepagePreviewHeight: null,
    homepageLogoUrl: null,
    homepageLogoWidth: null,
    homepageLogoHeight: null,
  }
}

function getDisplayImageUrl(event: H3Event, url: string): string | null {
  if (!isAllowedImageUrl(url)) return null

  const imageProxySecret = useRuntimeConfig(event).imageProxySecret
  return imageProxySecret ? toProxiedImageUrl(url, imageProxySecret) : url
}

export async function getHomepageMetadata(
  event: H3Event,
  homepageUrl: string | null | undefined,
): Promise<HomepageMetadata> {
  if (!homepageUrl) return emptyHomepageMetadata()

  const cachedFetch = event.context.cachedFetch as CachedFetchFunction | undefined
  if (!cachedFetch) return emptyHomepageMetadata(homepageUrl)

  try {
    const url = new URL(MICROLINK_API)
    url.searchParams.set('url', homepageUrl)

    // Microlink's free tier is limited to 50 requests/day, so keep this cached
    // aggressively. Homepage previews/logos rarely change, and stale media here
    // is fine for decorative UI enrichment.
    const { data } = await cachedFetch<unknown>(
      url.toString(),
      {
        headers: {
          'User-Agent': 'npmx',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(MICROLINK_FETCH_TIMEOUT_MS),
      },
      CACHE_MAX_AGE_ONE_DAY,
    )

    const parsedResponse = v.safeParse(MicrolinkResponseSchema, data)
    if (!parsedResponse.success) return emptyHomepageMetadata(homepageUrl)

    const image = parsedResponse.output.data.image
    const logo = parsedResponse.output.data.logo

    return {
      homepageUrl,
      homepagePreviewUrl: image ? getDisplayImageUrl(event, image.url) : null,
      homepagePreviewWidth: image?.width ?? null,
      homepagePreviewHeight: image?.height ?? null,
      homepageLogoUrl: logo ? getDisplayImageUrl(event, logo.url) : null,
      homepageLogoWidth: logo?.width ?? null,
      homepageLogoHeight: logo?.height ?? null,
    }
  } catch {
    return emptyHomepageMetadata(homepageUrl)
  }
}

export async function getPackageHomepageMetadata(
  event: H3Event,
  packageName: string,
): Promise<HomepageMetadata> {
  try {
    const packument = await fetchNpmPackage(packageName)
    const homepageUrl = typeof packument.homepage === 'string' ? packument.homepage : null
    return await getHomepageMetadata(event, homepageUrl)
  } catch {
    return emptyHomepageMetadata()
  }
}
