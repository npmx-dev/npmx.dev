export interface NpmWebsiteVersionDownload {
  version: string
  downloads: number
}

export interface NpmWebsiteVersionsData {
  weeklyDownloads?: number
  versions: NpmWebsiteVersionDownload[]
}

interface NpmApiVersionDownloadsResponse {
  downloads: Record<string, number>
}

interface NpmApiWeeklyDownloadsResponse {
  downloads: number
}

export async function fetchNpmVersionDownloadsFromApi(
  packageName: string,
): Promise<NpmWebsiteVersionsData> {
  const encodedName = encodePackageName(packageName)

  const [versionsResponse, weeklyDownloadsResponse] = await Promise.all([
    fetch(`https://api.npmjs.org/versions/${encodedName}/last-week`),
    fetch(`https://api.npmjs.org/downloads/point/last-week/${encodedName}`),
  ])

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
  const weeklyDownloadsData = weeklyDownloadsResponse.ok
    ? ((await weeklyDownloadsResponse.json()) as NpmApiWeeklyDownloadsResponse)
    : null

  return {
    weeklyDownloads: weeklyDownloadsData?.downloads,
    versions: Object.entries(versionsData.downloads).map(([version, downloads]) => ({
      version,
      downloads,
    })),
  }
}
