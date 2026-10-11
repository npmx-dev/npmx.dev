const encoder = new TextEncoder()

/**
 * Turns an arbitrary string into a collision-free cache key made only of `[A-Za-z0-9_]`.
 *
 * Nitro's `defineCachedEventHandler` strips every non-word character from custom keys,
 * so `esbuild/v/0.1.10` and `esbuild/v/0.11.0` would otherwise share a cache entry.
 * Every UTF-8 byte that is not an ASCII letter or digit (including `_` itself) is
 * encoded as `_` followed by its two-digit hex code, which keeps the mapping injective.
 */
export function toCacheKey(value: string): string {
  let key = ''
  for (const byte of encoder.encode(value)) {
    key += isAsciiAlphanumeric(byte)
      ? String.fromCharCode(byte)
      : `_${byte.toString(16).padStart(2, '0')}`
  }
  return key
}

function isAsciiAlphanumeric(byte: number): boolean {
  return (
    (byte >= 0x30 && byte <= 0x39) ||
    (byte >= 0x41 && byte <= 0x5a) ||
    (byte >= 0x61 && byte <= 0x7a)
  )
}
