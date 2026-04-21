// MIME types that are binary and cannot be meaningfully displayed as text
const BINARY_MIME_PREFIXES = new Set([
  'image/',
  'audio/',
  'video/',
  'font/',
  'application/wasm',
  'application/pdf',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-gzip',
  'application/x-tar',
  'application/x-bz2',
  'application/x-xz',
  'application/x-executable',
  'application/x-msdownload', // exe / dll
  'application/x-sharedlib', // so / dylib
  'application/msword', // .doc
  'application/vnd.',
  'application/octet-stream',
])

export function isBinaryContentType(contentType: string): boolean {
  for (const prefix of BINARY_MIME_PREFIXES) {
    if (contentType.startsWith(prefix)) {
      return true
    }
  }
  return false
}
