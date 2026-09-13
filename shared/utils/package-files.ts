export type PackageFileProvider = 'jsdelivr' | 'unpkg'

const PACKAGE_FILE_BASE_URLS: Record<PackageFileProvider, string> = {
  jsdelivr: 'https://cdn.jsdelivr.net/npm',
  unpkg: 'https://unpkg.com',
}

function encodeFilePath(filePath: string): string {
  return filePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')
}

export function getPackageFileUrl(
  provider: PackageFileProvider,
  packageName: string,
  version: string,
  filePath: string,
): string {
  const packageSpec = `${packageName}@${encodeURIComponent(version)}`
  return `${PACKAGE_FILE_BASE_URLS[provider]}/${packageSpec}/${encodeFilePath(filePath)}`
}

export function getPackageMetadataUrl(
  provider: PackageFileProvider,
  packageName: string,
  version: string,
): string {
  const packageSpec = `${packageName}@${encodeURIComponent(version)}`
  if (provider === 'jsdelivr') {
    return `https://data.jsdelivr.com/v1/packages/npm/${packageSpec}`
  }
  return `https://unpkg.com/${packageSpec}/?meta`
}

export function getPackageFileViewerUrl(
  packageName: string,
  version: string,
  filePath: string,
): string {
  const packageSpec = `${packageName}@${encodeURIComponent(version)}`
  return `https://app.unpkg.com/${packageSpec}/files/${encodeFilePath(filePath)}`
}
