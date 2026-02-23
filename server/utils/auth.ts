export function generateRandomHexString(byteLength: number = 16): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(byteLength)), byte =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
