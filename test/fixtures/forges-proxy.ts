import { FORGES_PROXY_URL } from '../../shared/utils/git-providers'

/** The `owner/name` a request to forges-proxy asks GitHub's `repos.get` for, or `undefined`. */
export function forgesProxyRepo(url: string): `${string}/${string}` | undefined {
  if (!url.startsWith(FORGES_PROXY_URL)) return undefined
  const { pathname, searchParams } = new URL(url)
  if (pathname !== '/github/github.com/repos.get') return undefined
  const [repo] = JSON.parse(searchParams.get('args') ?? '[]') as [{ owner: string; name: string }]
  return `${repo.owner}/${repo.name}`
}
