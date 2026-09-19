import type { PackageSearchResult } from '../search.ts'
import type { ThemePreference } from '../theme/index.ts'

export interface RunTuiOptions {
  version?: string
  themePreference?: ThemePreference
  apiBaseUrl?: string
}

export type AppMode = 'normal' | 'insert'
export type LayoutMode = 'single' | 'split'
export type WorkspaceView = 'collection' | 'inspector'
export type FocusTarget = 'search' | 'collection' | 'inspector'
export type SearchStatus = 'idle' | 'debouncing' | 'searching' | 'success' | 'empty' | 'error'
export type DetailStatus = 'idle' | 'loading' | 'success' | 'error'
export type StatusKind = 'info' | 'success' | 'warning' | 'danger'

export interface AppState {
  mode: AppMode
  focus: FocusTarget
  layout: LayoutMode
  view: WorkspaceView
  query: string
  searchStatus: SearchStatus
  results: PackageSearchResult[]
  total: number
  pageOffset: number
  selectedIndex: number
  inspectorScrollOffset: number
  statusKind: StatusKind
  statusMessage: string
  errorMessage?: string
}

export interface InspectorLine {
  text: string
  tone?: 'title' | 'section' | 'muted' | 'command' | 'warning' | 'danger'
}

export interface ShortcutAction {
  key: string
  label: string
}
