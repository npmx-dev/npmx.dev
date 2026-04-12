import { setTimeout } from 'node:timers/promises'
import type { NitroFetchOptions } from 'nitropack'

export interface GitHubFetchOptions extends NitroFetchOptions<string> {
  maxAttempts?: number
}

export async function fetchGitHubWithRetries<T>(
  url: string,
  options: GitHubFetchOptions = {},
): Promise<T | null> {
  const { maxAttempts = 3, ...fetchOptions } = options
  let delayMs = 1000

  const defaultHeaders = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'npmx',
    'X-GitHub-Api-Version': '2026-03-10',
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await $fetch.raw(url, {
        ...fetchOptions,
        headers: {
          ...defaultHeaders,
          ...fetchOptions.headers,
        },
      })

      if (response.status === 200) {
        return (response._data as T) ?? null
      }

      if (response.status === 204) {
        return null
      }

      if (response.status === 202) {
        if (attempt === maxAttempts - 1) break
        await setTimeout(delayMs)
        delayMs = Math.min(delayMs * 2, 16_000)
        continue
      }

      break
    } catch (error: unknown) {
      if (attempt === maxAttempts - 1) {
        throw error
      }
      await setTimeout(delayMs)
      delayMs = Math.min(delayMs * 2, 16_000)
    }
  }

  throw new Error(`Failed to fetch from GitHub after ${maxAttempts} attempts`)
}
