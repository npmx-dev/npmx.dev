/**
 * Prompts the user to download the file that is at the given link, using
 * the given default filename.
 *
 * Note: some browsers may ignore the `download` attribute for cross-origin URLs.
 *
 * @param link - The URL of the resource to download. This can be a normal URL,
 *               a data URL (e.g. "data:..."), or an object URL created via
 *               `URL.createObjectURL`.
 * @param filename - Suggested filename for the downloaded file. The browser may
 *                   override this value depending on user settings or the URL.
 */
export function downloadFileLink(link: string, filename: string) {
  const a = document.createElement('a')
  a.href = link
  a.download = filename
  a.click()
}

/**
 * Prompt the user to download the provided Blob as a file with the given filename.
 *
 * @param blob - The Blob to download.
 * @param filename - The filename that will be suggested to the user when saving.
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  downloadFileLink(url, filename)
  URL.revokeObjectURL(url)
}
