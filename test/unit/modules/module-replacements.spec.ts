import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { all } from 'module-replacements'
import type { NitroConfig } from 'nitropack'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const { addTemplate } = vi.hoisted(() => ({ addTemplate: vi.fn() }))

vi.mock('nuxt/kit', () => ({
  addTemplate,
  defineNuxtModule: <T>(module: T) => module,
}))

import { getModuleReplacement } from '../../../shared/utils/module-replacements'
import moduleReplacements, { addNotFoundRoute } from '../../../modules/module-replacements'

describe('module-replacements', () => {
  let rootDir: string

  beforeEach(() => {
    rootDir = mkdtempSync(resolve(tmpdir(), 'module-replacements-'))
    addTemplate.mockClear()
  })

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true })
  })

  it('writes a static JSON file per replacement under a content-hashed base', async () => {
    const hooks: Record<string, (config: NitroConfig) => void> = {}
    const nuxt = {
      options: { alias: {}, buildDir: join(rootDir, '.nuxt'), rootDir, dev: false },
      hook: (name: string, fn: (config: NitroConfig) => void) => {
        hooks[name] = fn
      },
    }
    // @ts-expect-error partial module and nuxt mocks
    await moduleReplacements.setup({}, nuxt)

    const nitroConfig: NitroConfig = {}
    hooks['nitro:config']!(nitroConfig)
    const [asset] = nitroConfig.publicAssets!
    expect(asset).toMatchObject({ baseURL: '/_replacements', fallthrough: false })

    const template = addTemplate.mock.calls[0]![0].getContents() as string
    const baseURL = template.match(/replacementsBaseURL = "([^"]+)"/)![1]!
    expect(baseURL).toMatch(/^\/_replacements\/[\da-f]{12}$/)

    for (const name of ['is-even', '@babel/plugin-proposal-object-rest-spread']) {
      const file = join(asset!.dir!, baseURL.replace('/_replacements/', ''), `${name}.json`)
      expect(JSON.parse(readFileSync(file, 'utf-8'))).toEqual(getModuleReplacement(name))
    }
    expect(getModuleReplacement('is-even')?.mapping).toEqual(all.mappings['is-even'])
  })

  it('answers misses under the base with a 404 after the filesystem check', () => {
    const configPath = join(rootDir, 'config.json')
    writeFileSync(
      configPath,
      JSON.stringify({ routes: [{ src: '/a' }, { handle: 'filesystem' }, { src: '/(.*)' }] }),
    )

    addNotFoundRoute(configPath)

    expect(JSON.parse(readFileSync(configPath, 'utf-8')).routes).toEqual([
      { src: '/a' },
      { handle: 'filesystem' },
      { src: '^/_replacements/.*$', status: 404, headers: { 'cache-control': 'no-store' } },
      { src: '/(.*)' },
    ])
  })
})
