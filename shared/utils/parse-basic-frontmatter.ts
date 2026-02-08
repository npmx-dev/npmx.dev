export function parseBasicFrontmatter(fileContent: string): Record<string, unknown> {
  const match = fileContent.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/)
  if (!match?.[1]) return {}

  return match[1].split('\n').reduce<Record<string, unknown>>((acc, line) => {
    const idx = line.indexOf(':')
    if (idx === -1) return acc

    const key = line.slice(0, idx).trim()

    // Remove surrounding quotes
    let value = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '')

    // Type coercion (handles 123, 45.6, boolean, arrays)
    if (value === 'true') acc[key] = true
    else if (value === 'false') acc[key] = false
    else if (/^-?\d+$/.test(value)) acc[key] = parseInt(value, 10)
    else if (/^-?\d+\.\d+$/.test(value)) acc[key] = parseFloat(value)
    else if (value.startsWith('[') && value.endsWith(']')) {
      acc[key] = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
    } else acc[key] = value

    return acc
  }, {})
}
