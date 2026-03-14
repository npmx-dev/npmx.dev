// Extensions that are binary and cannot be meaningfully displayed as text
const BINARY_EXTENSIONS = new Set([
  // Images
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'bmp',
  'tiff',
  'tif',
  'avif',
  'heic',
  'heif',
  // Fonts
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  // Archives
  'zip',
  'tar',
  'gz',
  'tgz',
  'bz2',
  'xz',
  '7z',
  'rar',
  // Executables / compiled
  'exe',
  'dll',
  'so',
  'dylib',
  'node',
  'wasm',
  'pyc',
  'class',
  // Media
  'mp3',
  'mp4',
  'ogg',
  'wav',
  'avi',
  'mov',
  'webm',
  'flac',
  'aac',
  'mkv',
  // Documents
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  // Data
  'bin',
  'dat',
  'db',
  'sqlite',
  'sqlite3',
])

export function isBinaryFilePath(filePath: string): boolean {
  const dotIndex = filePath.lastIndexOf('.')
  const ext = dotIndex > -1 ? filePath.slice(dotIndex + 1).toLowerCase() : ''
  return BINARY_EXTENSIONS.has(ext)
}
