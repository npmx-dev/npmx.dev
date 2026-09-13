import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSkillFile, findSkillDirs } from '#server/utils/skills'
import type { PackageFileTree } from '#shared/types'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchSkillFile', () => {
  it('loads skill content through the package CDN fallback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(
        new Response('# Skill', {
          headers: {
            'content-length': '7',
            'content-type': 'text/markdown',
          },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchSkillFile('pkg', '1.0.0', 'skills/demo/SKILL.md')).resolves.toBe('# Skill')
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://unpkg.com/pkg@1.0.0/skills/demo/SKILL.md',
      { signal: undefined },
    )
  })
})

describe('findSkillDirs', () => {
  it('rejects packages that would trigger excessive skill fetches', () => {
    const skills: PackageFileTree = {
      name: 'skills',
      path: 'skills',
      type: 'directory',
      children: Array.from({ length: 101 }, (_, index) => ({
        name: `skill-${index}`,
        path: `skills/skill-${index}`,
        type: 'directory' as const,
        children: [
          {
            name: 'SKILL.md',
            path: `skills/skill-${index}/SKILL.md`,
            type: 'file' as const,
          },
        ],
      })),
    }
    vi.stubGlobal(
      'createError',
      vi.fn((options: { statusCode: number; message: string }) =>
        Object.assign(new Error(options.message), options),
      ),
    )

    expect(() => findSkillDirs([skills])).toThrow('too many skills')
  })
})
