import { describe, expect, it } from 'vitest'
import {
  getPackageFileUrl,
  getPackageFileViewerUrl,
  getPackageMetadataUrl,
} from '#shared/utils/package-files'

describe('package file URLs', () => {
  it('builds provider URLs for scoped packages', () => {
    expect(getPackageMetadataUrl('jsdelivr', '@scope/pkg', '1.2.3')).toBe(
      'https://data.jsdelivr.com/v1/packages/npm/@scope/pkg@1.2.3',
    )
    expect(getPackageMetadataUrl('unpkg', '@scope/pkg', '1.2.3')).toBe(
      'https://unpkg.com/@scope/pkg@1.2.3/?meta',
    )
  })

  it('encodes versions and file path segments without encoding the package slash', () => {
    expect(getPackageFileUrl('unpkg', '@scope/pkg', '1.2.3+build.1', 'dist/file name?#.js')).toBe(
      'https://unpkg.com/@scope/pkg@1.2.3%2Bbuild.1/dist/file%20name%3F%23.js',
    )
    expect(getPackageFileViewerUrl('@scope/pkg', '1.2.3+build.1', 'dist/file name?#.js')).toBe(
      'https://app.unpkg.com/@scope/pkg@1.2.3%2Bbuild.1/files/dist/file%20name%3F%23.js',
    )
  })
})
