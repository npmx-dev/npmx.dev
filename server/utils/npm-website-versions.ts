export interface NpmWebsiteVersionDownload {
  version: string
  downloads: number
}

interface NpmApiVersionDownloadsResponse {
  downloads: Record<string, number>
}

export async function fetchNpmVersionDownloadsFromApi(
  packageName: string,
): Promise<NpmWebsiteVersionDownload[]> {
  const encodedName = encodePackageName(packageName)

  const versionsResponse = await fetch(`https://api.npmjs.org/versions/${encodedName}/last-week`)

  if (!versionsResponse.ok) {
    if (versionsResponse.status === 404) {
      throw createError({
        statusCode: 404,
        message: 'Package not found',
      })
    }

    throw createError({
      statusCode: 502,
      message: 'Failed to fetch version download data from npm API',
    })
  }

  const versionsData = (await versionsResponse.json()) as NpmApiVersionDownloadsResponse

  return Object.entries(versionsData.downloads).map(([version, downloads]) => ({
    version,
    downloads,
  }))
}
