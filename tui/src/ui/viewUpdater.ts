import type { CliRenderer } from '@opentui/core'
import { SPLIT_LAYOUT_MIN_WIDTH } from '../app/constants.ts'
import { selectedPackage } from '../app/selectors.ts'
import type { AppState, DetailStatus, StatusKind } from '../app/types.ts'
import type { PackageDetails } from '../search.ts'
import type { Theme } from '../theme/index.ts'
import { createCollectionListText, createResultsFooterText } from '../views/collection.ts'
import {
  createInspectorLines,
  createScrollableLines,
  createStyledInspectorText,
  getMaxInspectorScrollOffset,
} from '../views/inspector.ts'
import { createShortcutBarText } from '../views/shortcutBar.ts'
import type { AppThemeView } from './applyTheme.ts'

interface DetailViewState {
  detailStatus: DetailStatus
  detailError?: string
  detailCache: Map<string, PackageDetails>
}

interface CreateViewUpdaterOptions {
  renderer: CliRenderer
  view: AppThemeView
  state: AppState
  getTheme: () => Theme
  getDetailState: () => DetailViewState
}

export interface ViewUpdater {
  setStatus: (message: string, kind?: StatusKind) => void
  updateStatusBar: () => void
  updateCollectionTitle: () => void
  updateFocusStyles: () => void
  updateInspector: () => void
  updateCollection: () => void
  applyLayout: () => void
}

export function createViewUpdater({
  renderer,
  view,
  state,
  getTheme,
  getDetailState,
}: CreateViewUpdaterOptions): ViewUpdater {
  function getStatusBarWidth(): number {
    return Math.max(1, Number(view.statusBar.width) || renderer.terminalWidth)
  }

  function setStatus(message: string, kind: StatusKind = 'info'): void {
    const theme = getTheme()

    state.statusMessage = message
    state.statusKind = kind
    view.statusBar.content = createShortcutBarText(state, theme, getStatusBarWidth())
    view.statusBar.fg = theme.status[kind]
  }

  function updateStatusBar(): void {
    const theme = getTheme()

    view.statusBar.content = createShortcutBarText(state, theme, getStatusBarWidth())
    view.statusBar.fg = theme.status[state.statusKind]
  }

  function updateCollectionTitle(): void {
    const theme = getTheme()

    view.collectionPane.title = ' Results '
    view.searchPanel.bottomTitle = state.query.trim()
      ? `${state.results.length}/${state.total}`
      : 'npm registry'
    view.resultsFooter.content = createResultsFooterText(state, theme)
  }

  function updateFocusStyles(): void {
    const theme = getTheme()

    view.searchPanel.titleColor = state.focus === 'search' ? theme.accent : theme.fg.secondary
    view.searchPanel.borderColor = state.focus === 'search' ? theme.accent : theme.border.normal
    view.collectionPane.titleColor =
      state.focus === 'collection' ? theme.accent : theme.fg.secondary
    view.collectionPane.borderColor =
      state.focus === 'collection' ? theme.accent : theme.border.normal
    view.inspectorPane.titleColor = state.focus === 'inspector' ? theme.accent : theme.fg.secondary
    view.inspectorPane.borderColor =
      state.focus === 'inspector' ? theme.accent : theme.border.normal

    updateStatusBar()
  }

  function updateInspector(): void {
    const theme = getTheme()
    const { detailCache, detailError, detailStatus } = getDetailState()
    const pkg = selectedPackage(state)
    const detail = pkg ? detailCache.get(pkg.name) : undefined
    const content = createInspectorLines(pkg, detail, detailStatus, detailError)
    const viewportHeight = Math.max(1, view.inspector.height || 1)

    state.inspectorScrollOffset = Math.min(
      state.inspectorScrollOffset,
      getMaxInspectorScrollOffset(content, viewportHeight),
    )

    view.inspectorPane.title = ' Preview '
    view.inspector.content = createStyledInspectorText(
      createScrollableLines(content, state.inspectorScrollOffset, viewportHeight),
      theme,
    )
    updateFocusStyles()
  }

  function updateCollection(): void {
    const theme = getTheme()
    const collectionWidth = Math.max(1, Number(view.collectionList.width) || 80)
    const collectionHeight = Math.max(1, Number(view.collectionList.height) || 12)

    state.selectedIndex = Math.min(state.selectedIndex, Math.max(0, state.results.length - 1))
    view.collectionList.content = createCollectionListText(
      state,
      theme,
      collectionWidth,
      collectionHeight,
    )
    updateCollectionTitle()
    updateInspector()
  }

  function applyLayout(): void {
    state.layout = renderer.terminalWidth >= SPLIT_LAYOUT_MIN_WIDTH ? 'split' : 'single'

    if (state.layout === 'split') {
      state.view = 'collection'
      view.workspace.flexDirection = 'row'
      view.leftPane.visible = true
      view.inspectorPane.visible = true
      view.leftPane.width = '43%'
      view.inspectorPane.width = '57%'
      view.leftPane.flexGrow = 0
      view.inspectorPane.flexGrow = 0
    } else {
      view.workspace.flexDirection = 'column'
      const showingInspector = state.view === 'inspector'
      view.leftPane.visible = !showingInspector
      view.inspectorPane.visible = showingInspector
      view.leftPane.width = '100%'
      view.inspectorPane.width = '100%'
      view.leftPane.flexGrow = showingInspector ? 0 : 1
      view.inspectorPane.flexGrow = showingInspector ? 1 : 0
    }

    updateCollection()
    updateStatusBar()
  }

  return {
    setStatus,
    updateStatusBar,
    updateCollectionTitle,
    updateFocusStyles,
    updateInspector,
    updateCollection,
    applyLayout,
  }
}
