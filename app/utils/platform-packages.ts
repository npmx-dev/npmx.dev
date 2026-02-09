/**
 * Detects if a package name is a platform-specific native binary package.
 * These are typically optional dependencies that contain native binaries
 * for specific OS/architecture combinations (e.g., @oxlint/win32-x64, esbuild-darwin-arm64).
 * Sourced from searches for esbuild, and the napi-rs build triplets support matrix.
 */

const PLATFORMS = new Set([
  'win32',
  'darwin',
  'linux',
  'android',
  'freebsd',
  'openbsd',
  'netbsd',
  'sunos',
  'aix',
])

const ARCHITECTURES = new Set([
  'x64',
  'arm64',
  'arm',
  'ia32',
  'ppc64',
  'ppc64le',
  's390x',
  'riscv64',
  'mips64el',
  'loong64',
])

const ABI_SUFFIXES = new Set(['gnu', 'musl', 'msvc', 'gnueabihf'])

/**
 * Checks if a package name is a platform-specific native binary package.
 * Matches patterns like:
 * - @scope/pkg-win32-x64
 * - @scope/pkg-linux-arm64-gnu
 * - pkg-darwin-arm64
 * - @rollup/rollup-linux-x64-musl
 *
 * @param name - The full package name (including scope if present)
 * @returns true if the package appears to be a platform-specific binary
 */
export function isPlatformSpecificPackage(name: string): boolean {
  const unscopedName = name.startsWith('@') ? (name.split('/')[1] ?? '') : name
  if (!unscopedName) return false

  const parts = unscopedName.split('-')
  if (parts.length < 2) return false

  // Look for OS-arch pattern anywhere in the name as suffix parts
  // e.g., "pkg-linux-x64-gnu" -> ["pkg", "linux", "x64", "gnu"]
  for (let i = 0; i < parts.length - 1; i++) {
    const os = parts[i]
    const arch = parts[i + 1]

    if (os && arch && PLATFORMS.has(os) && ARCHITECTURES.has(arch)) {
      // Optional ABI suffix check (next part if exists)
      const abiSuffix = parts[i + 2]
      if (abiSuffix && !ABI_SUFFIXES.has(abiSuffix)) {
        // NOTE: Has an extra part after arch but it's not a known ABI - might be a false positive??
        // but still consider it a match if OS+arch pattern is found at the end
        if (i + 2 === parts.length - 1) {
          // Extra unknown suffix at the end - be conservative
          continue
        }
      }
      return true
    }
  }

  return false
}
