export interface RepoFileUrl {
  raw: string
  blob: string
}

export function getBaseFileUrl(ref: RepoRef): RepoFileUrl | null {
  switch (ref.provider) {
    case 'github':
      return {
        raw: `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/HEAD`,
        blob: `https://github.com/${ref.owner}/${ref.repo}/blob/HEAD`,
      }
    case 'codeberg':
      return {
        blob: `https://codeberg.org/${ref.owner}/${ref.repo}/src/branch/HEAD`,
        raw: `https://codeberg.org/${ref.owner}/${ref.repo}/raw/branch/HEAD`,
      }
    case 'forgejo': {
      const host = ref.host
      return {
        blob: `https://${host}/${ref.owner}/${ref.repo}/src/branch/HEAD`,
        raw: `https://${host}/${ref.owner}/${ref.repo}/raw/branch/HEAD`,
      }
    }
    case 'gitlab': {
      const host = ref.host || 'gitlab.com'
      return {
        blob: `https://${host}/${ref.owner}/${ref.repo}/-/blob/HEAD`,
        raw: `https://${host}/${ref.owner}/${ref.repo}/-/raw/HEAD`,
      }
    }
    case 'tangled': {
      return {
        blob: `https://tangled.org/${ref.owner}/${ref.repo}/blob/HEAD`,
        raw: `https://tangled.org/${ref.owner}/${ref.repo}/raw/HEAD`,
      }
    }
  }
  return null
}
