import { describe, expect, it } from 'vitest'

import { buildInstalledPackages } from './installed-packages'
import { resolve } from './resolve'

describe('buildInstalledPackages', () => {
  it('builds packages from a simple dependency tree', async () => {
    const result = await resolve(['is-odd@3.0.1'])
    const packages = buildInstalledPackages(result.roots[0]!, new Set())

    // should have is-odd and is-number
    const names = packages.map(p => p.name)
    expect(names).toContain('is-odd')
    expect(names).toContain('is-number')

    // is-odd should be level 0, is-number should be level 1
    const isOdd = packages.find(p => p.name === 'is-odd')!
    const isNumber = packages.find(p => p.name === 'is-number')!
    expect(isOdd.level).toBe(0)
    expect(isNumber.level).toBe(1)

    // none should be marked as peer (no peer deps)
    expect(packages.every(p => !p.isPeer)).toBe(true)
  })

  it('correctly sets dependents', async () => {
    const result = await resolve(['is-odd@3.0.1'])
    const packages = buildInstalledPackages(result.roots[0]!, new Set())

    // is-odd is the root, no dependents
    const isOdd = packages.find(p => p.name === 'is-odd')!
    expect(isOdd.dependents.length).toBe(0)

    // is-number is depended on by is-odd
    const isNumber = packages.find(p => p.name === 'is-number')!
    expect(isNumber.dependents.length).toBe(1)
    expect(isNumber.dependents[0]!.name).toBe('is-odd')
  })

  it('correctly sets dependencies', async () => {
    const result = await resolve(['is-odd@3.0.1'])
    const packages = buildInstalledPackages(result.roots[0]!, new Set())

    // is-odd has 1 dependency (is-number)
    const isOdd = packages.find(p => p.name === 'is-odd')!
    expect(isOdd.dependencies.length).toBe(1)
    expect(isOdd.dependencies[0]!.name).toBe('is-number')
  })

  it('marks peer dependencies correctly', async () => {
    // use-sync-external-store has react as a peer dependency
    const result = await resolve(['use-sync-external-store@1.2.0'])
    const peerDepNames = new Set(['react'])
    const packages = buildInstalledPackages(result.roots[0]!, peerDepNames)

    // react and its deps should be marked as peer
    const react = packages.find(p => p.name === 'react')
    expect(react).toBeDefined()
    expect(react!.isPeer).toBe(true)

    // use-sync-external-store should not be marked as peer
    const main = packages.find(p => p.name === 'use-sync-external-store')!
    expect(main.isPeer).toBe(false)

    // the dependency edge to react should be marked as peer
    const reactDep = main.dependencies.find(d => d.name === 'react')
    expect(reactDep).toBeDefined()
    expect(reactDep!.isPeer).toBe(true)
  })

  it('marks transitive peer deps correctly', async () => {
    // use-sync-external-store@1.2.0 has react as peer
    // react has loose-envify as a regular dep
    // loose-envify should be marked as peer (only reachable through react)
    const result = await resolve(['use-sync-external-store@1.2.0'])
    const peerDepNames = new Set(['react'])
    const packages = buildInstalledPackages(result.roots[0]!, peerDepNames)

    const looseEnvify = packages.find(p => p.name === 'loose-envify')
    // loose-envify is a dep of react, which is peer-only
    expect(looseEnvify!.isPeer).toBe(true)
  })

  it('marks direct peer deps as peer even when also a transitive dep', async () => {
    // if a package is a direct peer dep of root but also reachable through
    // a transitive non-peer path, it should still be marked as peer
    const result = await resolve(['is-odd@3.0.1'])

    // pretend is-number is also a peer dep (but it's already a regular dep)
    const peerDepNames = new Set(['is-number'])
    const packages = buildInstalledPackages(result.roots[0]!, peerDepNames)

    // is-number should be marked as peer because it's a direct peer dep of root
    const isNumber = packages.find(p => p.name === 'is-number')!
    expect(isNumber.isPeer).toBe(true)
  })

  it('marks peer deps as peer when also reachable through transitive deps', async () => {
    // graphql-request has graphql as a peer dep
    // @graphql-typed-document-node/core (a regular dep) also depends on graphql
    // graphql should still be marked as peer since it's a direct peer dep of root
    const result = await resolve(['graphql-request@7.4.0'])
    const peerDepNames = new Set(['graphql'])
    const packages = buildInstalledPackages(result.roots[0]!, peerDepNames)

    // graphql should be marked as peer
    const graphql = packages.find(p => p.name === 'graphql')
    expect(graphql).toBeDefined()
    expect(graphql!.isPeer).toBe(true)

    // @graphql-typed-document-node/core should NOT be marked as peer
    const typedDocNode = packages.find(p => p.name === '@graphql-typed-document-node/core')
    expect(typedDocNode).toBeDefined()
    expect(typedDocNode!.isPeer).toBe(false)
  })
})
