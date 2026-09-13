import type { SortOption } from './preferences'

export type DepSectionId =
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'optionalDependencies'
  | 'bundledDependencies'

export type DepRegistry = 'npm' | 'jsr'

export type DepFlag = 'optional' | 'bundled'

export interface PackageDependencyItem {
  name: string
  packageName: string
  range: string
  registry: DepRegistry
  flags: DepFlag[]
}

export interface PackageDependencySection {
  id: DepSectionId
  items: PackageDependencyItem[]
}

export type DependencySortOption = SortOption
