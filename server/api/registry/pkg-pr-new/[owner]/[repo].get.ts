import type { H3Event } from 'h3'

const PKG_PR_NEW_TTL_SECONDS = 60
const PKG_PR_NEW_TIMEOUT_MS = 3000
// GitHub owner and repository names only use letters, digits, `-`, `_` and `.`, and are never `.` or `..`
const GITHUB_NAME_RE = /^(?!\.\.?$)[\w.-]+$/

function toSegment(value: string | undefined): string {
  return value?.trim() ?? ''
}

function getRepoParams(event: H3Event) {
  return {
    owner: toSegment(getRouterParam(event, 'owner', { decode: true })),
    repo: toSegment(getRouterParam(event, 'repo', { decode: true })),
  }
}

export default defineCachedEventHandler(
  async (event): Promise<PkgPrNewAvailability> => {
    const { owner, repo } = getRepoParams(event)

    if (!GITHUB_NAME_RE.test(owner) || !GITHUB_NAME_RE.test(repo)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid owner/repo',
      })
    }

    const url = `https://pkg.pr.new/~/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

    try {
      const response = await $fetch.raw(url, {
        method: 'HEAD',
        timeout: PKG_PR_NEW_TIMEOUT_MS,
        retry: 0,
      })
      return {
        hasReleases: response.headers.get('x-has-releases') === '1',
        url,
      }
    } catch {
      return {
        hasReleases: false,
        url,
      }
    }
  },
  {
    maxAge: PKG_PR_NEW_TTL_SECONDS,
    swr: true,
    name: 'pkg-pr-new-availability',
    getKey: event => {
      const { owner, repo } = getRepoParams(event)
      return `pkg-pr-new:${owner.toLowerCase()}/${repo.toLowerCase()}`
    },
  },
)
