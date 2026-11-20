import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { DocEntry } from '#server/utils/docs/types'

const getDocEntries = vi.hoisted(() => vi.fn<() => Promise<DocEntry[]>>())
vi.mock('#server/utils/docs/client', () => ({ getDocEntries }))

function unrecognizedEnumEntries(): DocEntry[] {
  const declaration = {
    kind: 'enum',
    declarationKind: 'export',
    location: { filename: 'file:///test.d.ts', line: 1, col: 0 },
  }
  return [
    {
      entryPoint: 'index',
      symbols: [{ name: 'Level', isDefault: false, declarations: [declaration] }],
    },
  ] as unknown as DocEntry[]
}

describe('generateDocsWithDeno', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null and logs once per process when the @deno/doc shape is unrecognised', async () => {
    getDocEntries.mockResolvedValue(unrecognizedEnumEntries())
    const { generateDocsWithDeno } = await import('#server/utils/docs')

    expect(await generateDocsWithDeno('pkg-a', '1.0.0')).toBeNull()
    expect(await generateDocsWithDeno('pkg-b', '1.0.0')).toBeNull()

    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('pkg-a@1.0.0'))
  })
})
