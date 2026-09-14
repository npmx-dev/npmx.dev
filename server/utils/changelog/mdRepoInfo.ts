import type { MarkdownRepoInfo } from './markdown'

export function createGithubRepoInfo(owner: string, repo: string, path?: string): MarkdownRepoInfo {
  const hostBaseUrl = 'https://github.com'

  return {
    hostBaseUrl,
    blobBaseUrl: `${hostBaseUrl}/${owner}/${repo}/blob/HEAD`,
    rawBaseUrl: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD`,
    path,
    commitBaseUrl: `${hostBaseUrl}/${owner}/${repo}/commit`,
    issueChar: '#',
    issueBaseUrl: `${hostBaseUrl}/${owner}/${repo}/issues`,
    prChar: '#',
    prBaseUrl: `${hostBaseUrl}/${owner}/${repo}/pull`,
    compareBaseUrl: `${hostBaseUrl}/${owner}/${repo}/compare`,
  }
}

export function createForgejoRepoInfo(
  host: string,
  owner: string,
  repo: string,
  path?: string,
): MarkdownRepoInfo {
  const hostBaseUrl = `https://${host}`

  return {
    hostBaseUrl,
    blobBaseUrl: `${hostBaseUrl}/${owner}/${repo}/src/branch/HEAD`,
    rawBaseUrl: `${hostBaseUrl}/${owner}/${repo}/raw/branch/HEAD`,
    path,
    commitBaseUrl: `${hostBaseUrl}/${owner}/${repo}/commit`,
    issueChar: '#',
    issueBaseUrl: `${hostBaseUrl}/${owner}/${repo}/issues`,
    prChar: '#',
    prBaseUrl: `${hostBaseUrl}/${owner}/${repo}/pulls`,
    compareBaseUrl: `${hostBaseUrl}/${owner}/${repo}/compare`,
  }
}

export function createGitLabRepoInfo(
  host: string,
  owner: string,
  repo: string,
  path?: string,
): MarkdownRepoInfo {
  const hostBaseUrl = `https://${host}`

  return {
    hostBaseUrl,
    blobBaseUrl: `${hostBaseUrl}/${owner}/${repo}/-/blob/HEAD`,
    rawBaseUrl: `${hostBaseUrl}/${owner}/${repo}/-/raw/HEAD`,
    path,
    commitBaseUrl: `${hostBaseUrl}/${owner}/${repo}/-/commit`,
    issueChar: '#',
    // it seems that issues are work items in gitlab
    issueBaseUrl: `${hostBaseUrl}/${owner}/${repo}/-/work_items`,
    prChar: '!',
    prBaseUrl: `${hostBaseUrl}/${owner}/${repo}/-/merge_requests`,
    compareBaseUrl: `${hostBaseUrl}/${owner}/${repo}/-/compare`,
  }
}

export function createTangledInfo(owner: string, repo: string, path?: string): MarkdownRepoInfo {
  const hostBaseUrl = 'https://tangled.org'

  return {
    hostBaseUrl,
    blobBaseUrl: `${hostBaseUrl}/${owner}/${repo}/blob/HEAD`,
    rawBaseUrl: `${hostBaseUrl}/${owner}/${repo}/raw/HEAD/`,
    path,
    commitBaseUrl: `${hostBaseUrl}/${owner}/${repo}/commit`,
    issueChar: '#',
    issueBaseUrl: `${hostBaseUrl}/${owner}/${repo}/issues`,
    prChar: '#',
    prBaseUrl: `${hostBaseUrl}/${owner}/${repo}/pulls`,
    compareBaseUrl: `${hostBaseUrl}/${owner}/${repo}/compare`,
  }
}

// similar to forgejo, but they're seperate projects so keeping this also seperate
export function createGiteaRepoInfo(
  host: string,
  owner: string,
  repo: string,
  path?: string,
): MarkdownRepoInfo {
  const hostBaseUrl = `https://${host}`
  return {
    hostBaseUrl,
    blobBaseUrl: `${hostBaseUrl}/${owner}/${repo}/src/branch/HEAD`,
    rawBaseUrl: `${hostBaseUrl}/${owner}/${repo}/raw/branch/HEAD`,
    path,
    commitBaseUrl: `${hostBaseUrl}/${owner}/${repo}/commit`,
    issueChar: '#',
    issueBaseUrl: `${hostBaseUrl}/${owner}/${repo}/issues`,
    prChar: '#',
    prBaseUrl: `${hostBaseUrl}/${owner}/${repo}/pulls`,
    compareBaseUrl: `${hostBaseUrl}/${owner}/${repo}/compare`,
  }
}

export function createBitbucketRepoInfo(
  owner: string,
  repo: string,
  path?: string,
): MarkdownRepoInfo {
  const hostBaseUrl = 'https://bitbucket.org'
  return {
    hostBaseUrl,
    blobBaseUrl: `${hostBaseUrl}/${owner}/${repo}/src/HEAD`,
    rawBaseUrl: `${hostBaseUrl}/${owner}/${repo}/raw/HEAD`,
    path,
    commitBaseUrl: `${hostBaseUrl}/${owner}/${repo}/commits`,
    prChar: '#',
    prBaseUrl: `${hostBaseUrl}/${owner}/${repo}/pull-requests`,
    // bitbucket uses jira instead of normal issues which can't be resolved, further the compare page also seems to be different
  }
}

export function createSourcehutRepoInfo(
  owner: string,
  repo: string,
  path?: string,
): MarkdownRepoInfo {
  const hostBaseUrl = 'https://git.sr.ht'
  return {
    hostBaseUrl,
    blobBaseUrl: `${hostBaseUrl}/${owner}/${repo}/tree/HEAD/item`,
    rawBaseUrl: `${hostBaseUrl}/${owner}/${repo}/blob/HEAD`,
    path,
    commitBaseUrl: `${hostBaseUrl}/${owner}/${repo}/commit`,
    // source hut doesn't have/support issues,pr & compare
  }
}

export function createGiteeRepoInfo(owner: string, repo: string, path?: string): MarkdownRepoInfo {
  const hostBaseUrl = `https://gitee.com`
  return {
    hostBaseUrl,
    blobBaseUrl: `${hostBaseUrl}/${owner}/${repo}/blob/HEAD`,
    rawBaseUrl: `${hostBaseUrl}/${owner}/${repo}/raw/HEAD`,
    path,
    commitBaseUrl: `${hostBaseUrl}/${owner}/${repo}/commit`,
    issueChar: '#',
    issueBaseUrl: `${hostBaseUrl}/${owner}/${repo}/issues`,
    issueRegex: /\B#[\dA-Z]+\b/gi,
    prChar: '!',
    prBaseUrl: `${hostBaseUrl}/${owner}/${repo}/pulls`,
    compareBaseUrl: `${hostBaseUrl}/${owner}/${repo}/compare`,
  }
}
