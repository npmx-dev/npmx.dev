import { describe, expect, it } from 'vitest'

const fakeRequestedVersion = (
  data: Partial<SlimPackument['requestedVersion']>,
): SlimPackument['requestedVersion'] => {
  return {
    _id: 'any',
    _npmVersion: 'idk',
    dist: {
      shasum: '',
      signatures: [],
      tarball: '',
    },
    name: 'any',
    version: '0.0.1',
    ...data,
  }
}

describe('useRepositoryUrl', () => {
  it('should have valid github repository url', () => {
    const test = fakeRequestedVersion({
      repository: {
        type: 'git',
        url: 'git+https://github.com/nuxt/nuxt.git',
        directory: 'packages/nuxt',
      },
    })

    const result = useRepositoryUrl(test)

    expect(result.repositoryUrl.value).toEqual(
      'https://github.com/nuxt/nuxt/tree/HEAD/packages/nuxt',
    )
  })
})
