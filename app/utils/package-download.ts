interface DownloadablePackageVersion {
  version: string
  dist: {
    tarball?: string | null
  }
}

async function getDownloadUrl(tarballUrl: string) {
  try {
    const response = await fetch(tarballUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch tarball (${response.status})`)
    }
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch (error) {
    // oxlint-disable-next-line no-console -- error logging
    console.error('failed to fetch tarball', { cause: error })
    return null
  }
}

export async function downloadPackageTarball(
  packageName: string,
  version: DownloadablePackageVersion,
) {
  const tarballUrl = version.dist.tarball
  if (!tarballUrl) return

  const downloadUrl = await getDownloadUrl(tarballUrl)

  const link = document.createElement('a')
  link.href = downloadUrl ?? tarballUrl
  link.download = `${packageName.replace(/\//g, '__')}-${version.version}.tgz`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl)
  }
}
