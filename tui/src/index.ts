import {
  Box,
  CliRenderEvents,
  Input,
  InputRenderableEvents,
  RGBA,
  Text,
  createCliRenderer,
  instantiate,
  type BoxRenderable,
  type CliRenderer,
  type InputRenderable,
  type KeyEvent,
  type TextRenderable,
} from '@opentui/core'
import {
  getDefaultApiBaseUrl,
  getPackageDetails,
  searchPackages,
  type PackageDetails,
} from './search.ts'
import {
  BRAILLE_SPINNER_FRAMES,
  SEARCH_DEBOUNCE_MS,
  SEARCH_RESULT_LIMIT,
  SPINNER_FRAME_MS,
  SPLIT_LAYOUT_MIN_WIDTH,
} from './app/constants.ts'
import { truncateText } from './app/format.ts'
import type { AppState, DetailStatus, RunTuiOptions } from './app/types.ts'
import { isCtrlKey, isPlainKey, shouldQuit } from './app/keys.ts'
import { hasNextResultsPage, hasPreviousResultsPage, selectedPackage } from './app/selectors.ts'
import { applyThemeToView, type AppThemeView } from './ui/applyTheme.ts'
import { createViewUpdater } from './ui/viewUpdater.ts'
import { createThemeManager, type Theme } from './theme/index.ts'
import { createCollectionListText, createResultsFooterText } from './views/collection.ts'
import {
  createInspectorLines,
  createStyledInspectorText,
  getMaxInspectorScrollOffset,
} from './views/inspector.ts'
import { createShortcutBarText } from './views/shortcutBar.ts'

function getRuntimeHint(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  return `${message}

OpenTUI's native renderer requires Node.js 26.4.0+ with experimental FFI enabled.
Run this TUI with a compatible runtime, for example:

  node --experimental-ffi tui/src/cli.ts

Current Node.js: ${process.version}`
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export async function runTui(options: RunTuiOptions = {}): Promise<void> {
  const themePreference = options.themePreference ?? 'system'
  const apiBaseUrl = options.apiBaseUrl ?? getDefaultApiBaseUrl()
  let renderer: CliRenderer

  try {
    renderer = await createCliRenderer({
      exitOnCtrlC: true,
      clearOnShutdown: true,
      targetFps: 30,
      backgroundColor: RGBA.defaultBackground(),
    })
  } catch (error) {
    throw new Error(getRuntimeHint(error), { cause: error })
  }

  const themeManager = await createThemeManager(renderer, {
    preference: themePreference,
  })
  let theme = themeManager.theme

  const state: AppState = {
    mode: 'insert',
    focus: 'search',
    layout: renderer.terminalWidth >= SPLIT_LAYOUT_MIN_WIDTH ? 'split' : 'single',
    view: 'collection',
    query: '',
    searchStatus: 'idle',
    results: [],
    total: 0,
    pageOffset: 0,
    selectedIndex: 0,
    inspectorScrollOffset: 0,
    statusKind: 'info',
    statusMessage: 'Search focused',
  }

  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let activeRequest: AbortController | undefined
  let activeDetailRequest: AbortController | undefined
  let spinnerTimer: ReturnType<typeof setInterval> | undefined
  let spinnerFrame = 0
  let requestId = 0
  let detailRequestId = 0
  let detailStatus: DetailStatus = 'idle'
  let detailError: string | undefined
  const detailCache = new Map<string, PackageDetails>()

  const prompt = instantiate(
    renderer,
    Text({
      content: '>',
      fg: theme.accent,
      bg: theme.bg.base,
      width: 2,
      height: 1,
    }),
  ) as TextRenderable

  const input = instantiate(
    renderer,
    Input({
      placeholder: 'Search npm packages',
      width: 'auto',
      flexGrow: 1,
      flexShrink: 1,
      maxLength: 100,
      backgroundColor: theme.bg.base,
      textColor: theme.fg.primary,
      placeholderColor: theme.fg.muted,
      focusedTextColor: theme.fg.primary,
      focusedBackgroundColor: theme.bg.base,
      cursorColor: theme.accent,
      showCursor: true,
    }),
  ) as InputRenderable

  const spinner = instantiate(
    renderer,
    Text({
      content: '',
      fg: theme.accent,
      bg: theme.bg.base,
      width: 1,
      height: 1,
    }),
  ) as TextRenderable

  const inputRow = instantiate(
    renderer,
    Box(
      {
        backgroundColor: theme.bg.base,
        flexDirection: 'row',
        gap: 1,
        width: '100%',
        height: 1,
      },
      prompt,
      input,
      spinner,
    ),
  ) as BoxRenderable

  const searchPanel = instantiate(
    renderer,
    Box(
      {
        backgroundColor: theme.bg.base,
        border: true,
        borderStyle: 'single',
        borderColor: theme.border.normal,
        focusedBorderColor: theme.border.focused,
        title: ' packages ',
        titleColor: theme.fg.secondary,
        bottomTitle: 'npm registry',
        bottomTitleAlignment: 'right',
        flexDirection: 'column',
        paddingX: 1,
        width: '100%',
        height: 3,
      },
      inputRow,
    ),
  ) as BoxRenderable

  const collectionList = instantiate(
    renderer,
    Text({
      content: createCollectionListText(state, theme),
      fg: theme.fg.secondary,
      bg: theme.bg.base,
      width: '100%',
      height: 'auto',
      flexGrow: 1,
      wrapMode: 'none',
      truncate: true,
    }),
  ) as TextRenderable

  const resultsFooter = instantiate(
    renderer,
    Text({
      content: createResultsFooterText(state, theme),
      fg: theme.fg.muted,
      bg: theme.bg.base,
      height: 2,
      truncate: true,
    }),
  ) as TextRenderable

  const collectionPane = instantiate(
    renderer,
    Box(
      {
        backgroundColor: theme.bg.base,
        border: true,
        borderStyle: 'single',
        borderColor: theme.border.normal,
        focusedBorderColor: theme.border.focused,
        title: ' Results ',
        titleColor: theme.fg.secondary,
        flexDirection: 'column',
        paddingX: 1,
        paddingY: 0,
        width: '100%',
        height: 'auto',
        flexGrow: 1,
      },
      collectionList,
      resultsFooter,
    ),
  ) as BoxRenderable

  const inspector = instantiate(
    renderer,
    Text({
      content: createStyledInspectorText(createInspectorLines(undefined), theme),
      fg: theme.fg.secondary,
      bg: theme.bg.base,
      height: 'auto',
      flexGrow: 1,
      wrapMode: 'word',
      truncate: false,
    }),
  ) as TextRenderable

  const inspectorPane = instantiate(
    renderer,
    Box(
      {
        backgroundColor: theme.bg.base,
        border: true,
        borderStyle: 'single',
        borderColor: theme.border.normal,
        focusedBorderColor: theme.border.focused,
        title: ' Preview ',
        titleColor: theme.fg.secondary,
        flexDirection: 'column',
        paddingX: 1,
        paddingY: 1,
        width: '57%',
        height: '100%',
      },
      inspector,
    ),
  ) as BoxRenderable

  const leftPane = instantiate(
    renderer,
    Box(
      {
        backgroundColor: theme.bg.base,
        flexDirection: 'column',
        gap: 1,
        width: '43%',
        height: '100%',
      },
      searchPanel,
      collectionPane,
    ),
  ) as BoxRenderable

  const workspace = instantiate(
    renderer,
    Box(
      {
        backgroundColor: theme.bg.base,
        flexDirection: 'row',
        gap: 1,
        width: '100%',
        height: 'auto',
        flexGrow: 1,
      },
      leftPane,
      inspectorPane,
    ),
  ) as BoxRenderable

  const statusBar = instantiate(
    renderer,
    Text({
      content: createShortcutBarText(state, theme, renderer.terminalWidth),
      fg: theme.fg.muted,
      bg: theme.bg.base,
      height: 1,
      truncate: true,
    }),
  ) as TextRenderable

  const shell = instantiate(
    renderer,
    Box(
      {
        backgroundColor: theme.bg.base,
        flexDirection: 'column',
        width: '100%',
        height: '100%',
      },
      workspace,
      statusBar,
    ),
  ) as BoxRenderable

  const appThemeView: AppThemeView = {
    shell,
    searchPanel,
    inputRow,
    workspace,
    leftPane,
    collectionPane,
    inspectorPane,
    prompt,
    input,
    spinner,
    collectionList,
    inspector,
    resultsFooter,
    statusBar,
  }

  const viewUpdater = createViewUpdater({
    renderer,
    view: appThemeView,
    state,
    getTheme: () => theme,
    getDetailState: () => ({
      detailStatus,
      detailError,
      detailCache,
    }),
  })

  async function loadSelectedPackageDetails(): Promise<void> {
    const pkg = selectedPackage(state)
    activeDetailRequest?.abort()
    detailRequestId += 1

    if (!pkg) {
      detailStatus = 'idle'
      detailError = undefined
      viewUpdater.updateInspector()
      return
    }

    if (detailCache.has(pkg.name)) {
      detailStatus = 'success'
      detailError = undefined
      viewUpdater.updateInspector()
      return
    }

    const currentDetailRequestId = detailRequestId
    const controller = new AbortController()
    activeDetailRequest = controller
    detailStatus = 'loading'
    detailError = undefined
    viewUpdater.updateInspector()

    try {
      const detail = await getPackageDetails({
        baseUrl: apiBaseUrl,
        name: pkg.name,
        signal: controller.signal,
      })

      if (currentDetailRequestId !== detailRequestId) {
        return
      }

      detailCache.set(pkg.name, detail)
      detailStatus = 'success'
      detailError = undefined
      viewUpdater.updateInspector()
    } catch (error) {
      if (
        controller.signal.aborted ||
        isAbortError(error) ||
        currentDetailRequestId !== detailRequestId
      ) {
        return
      }

      detailStatus = 'error'
      detailError = error instanceof Error ? error.message : String(error)
      viewUpdater.updateInspector()
    }
  }

  function stopSpinner(): void {
    if (spinnerTimer) {
      clearInterval(spinnerTimer)
      spinnerTimer = undefined
    }

    spinner.content = ''
  }

  function startSpinner(): void {
    stopSpinner()
    spinnerFrame = 0
    spinner.content = BRAILLE_SPINNER_FRAMES[spinnerFrame] ?? ''

    spinnerTimer = setInterval(() => {
      spinnerFrame += 1
      spinner.content = BRAILLE_SPINNER_FRAMES[spinnerFrame % BRAILLE_SPINNER_FRAMES.length] ?? ''
    }, SPINNER_FRAME_MS)
  }

  function focusSearch(): void {
    state.mode = 'insert'
    state.focus = 'search'
    if (state.layout === 'single') {
      state.view = 'collection'
    }
    input.showCursor = true
    input.focus()
    viewUpdater.setStatus('Search focused')
    viewUpdater.applyLayout()
  }

  function focusCollection(): void {
    state.mode = 'normal'
    state.focus = 'collection'
    input.showCursor = false
    input.blur()

    if (state.layout === 'single') {
      state.view = 'collection'
      viewUpdater.applyLayout()
    } else {
      viewUpdater.updateFocusStyles()
    }

    viewUpdater.setStatus('Results focused')
  }

  function focusInspector(): boolean {
    const pkg = selectedPackage(state)
    if (!pkg) {
      return false
    }

    state.mode = 'normal'
    state.focus = 'inspector'
    input.showCursor = false
    input.blur()

    if (state.layout === 'single') {
      state.view = 'inspector'
      viewUpdater.applyLayout()
    } else {
      viewUpdater.updateFocusStyles()
    }

    viewUpdater.setStatus(`Details focused: ${pkg.name}@${pkg.version}`)
    return true
  }

  function moveSelection(direction: 'up' | 'down'): void {
    if (state.results.length === 0) {
      return
    }

    if (direction === 'up') {
      state.selectedIndex = Math.max(0, state.selectedIndex - 1)
    } else {
      state.selectedIndex = Math.min(state.results.length - 1, state.selectedIndex + 1)
    }

    state.inspectorScrollOffset = 0
    viewUpdater.updateCollection()
    void loadSelectedPackageDetails()
    const pkg = selectedPackage(state)
    if (pkg) {
      viewUpdater.setStatus(`${pkg.name}@${pkg.version}`)
    }
  }

  function scrollInspector(direction: 'up' | 'down', amount = 1): void {
    const pkg = selectedPackage(state)
    if (!pkg) {
      return
    }

    const detail = detailCache.get(pkg.name)
    const content = createInspectorLines(pkg, detail, detailStatus, detailError)
    const viewportHeight = Math.max(1, inspector.height || 1)
    const maxOffset = getMaxInspectorScrollOffset(content, viewportHeight)
    const nextOffset =
      direction === 'up'
        ? Math.max(0, state.inspectorScrollOffset - amount)
        : Math.min(maxOffset, state.inspectorScrollOffset + amount)

    if (nextOffset === state.inspectorScrollOffset) {
      viewUpdater.setStatus(direction === 'up' ? 'Top of details' : 'End of details')
      return
    }

    state.inspectorScrollOffset = nextOffset
    viewUpdater.updateInspector()
    viewUpdater.setStatus(`Details ${state.inspectorScrollOffset + 1}/${maxOffset + 1}`)
  }

  function openSelection(): void {
    const pkg = selectedPackage(state)
    if (!pkg) {
      return
    }

    state.inspectorScrollOffset = 0
    focusInspector()
    viewUpdater.setStatus(`Previewing ${pkg.name}@${pkg.version}`)
  }

  function showCollection(): boolean {
    if (state.focus === 'inspector' || (state.layout === 'single' && state.view === 'inspector')) {
      focusCollection()
      return true
    }

    return false
  }

  function focusResultsFromSearch(position: 'current' | 'first' | 'last' = 'current'): boolean {
    if (state.results.length === 0) {
      viewUpdater.setStatus('No results to focus')
      return true
    }

    if (position === 'first') {
      state.selectedIndex = 0
    } else if (position === 'last') {
      state.selectedIndex = state.results.length - 1
    }

    state.inspectorScrollOffset = 0
    focusCollection()
    viewUpdater.updateCollection()
    void loadSelectedPackageDetails()
    return true
  }

  function pageResults(direction: 'previous' | 'next'): boolean {
    if (
      !state.query.trim() ||
      state.searchStatus === 'searching' ||
      state.searchStatus === 'debouncing'
    ) {
      return false
    }

    const nextOffset =
      direction === 'previous'
        ? Math.max(0, state.pageOffset - SEARCH_RESULT_LIMIT)
        : state.pageOffset + SEARCH_RESULT_LIMIT

    if (direction === 'previous' && !hasPreviousResultsPage(state)) {
      viewUpdater.setStatus('First results page')
      return true
    }

    if (direction === 'next' && !hasNextResultsPage(state)) {
      viewUpdater.setStatus('Last results page')
      return true
    }

    state.inspectorScrollOffset = 0
    void runSearch(state.query, nextOffset)
    return true
  }

  async function runSearch(query: string, pageOffset = state.pageOffset): Promise<void> {
    const trimmed = query.trim()
    const currentRequestId = ++requestId
    const nextPageOffset = Math.max(0, pageOffset)
    activeRequest?.abort()
    activeDetailRequest?.abort()
    detailRequestId += 1
    detailStatus = 'idle'
    detailError = undefined

    if (!trimmed) {
      stopSpinner()
      state.query = ''
      state.searchStatus = 'idle'
      state.results = []
      state.total = 0
      state.pageOffset = 0
      state.selectedIndex = 0
      state.inspectorScrollOffset = 0
      state.errorMessage = undefined
      viewUpdater.updateCollection()
      viewUpdater.setStatus(state.focus === 'search' ? 'Search focused' : 'Results focused')
      return
    }

    const controller = new AbortController()
    activeRequest = controller
    state.searchStatus = 'searching'
    state.errorMessage = undefined
    startSpinner()
    viewUpdater.updateCollection()
    viewUpdater.setStatus(`Searching "${truncateText(trimmed, 48)}"`)

    try {
      const response = await searchPackages({
        baseUrl: apiBaseUrl,
        query: trimmed,
        size: SEARCH_RESULT_LIMIT,
        from: nextPageOffset,
        signal: controller.signal,
      })

      if (currentRequestId !== requestId) {
        return
      }

      stopSpinner()
      state.results = response.results
      state.total = response.total
      state.pageOffset = nextPageOffset
      state.selectedIndex = 0
      state.inspectorScrollOffset = 0
      state.searchStatus = response.results.length > 0 ? 'success' : 'empty'
      state.errorMessage = undefined
      viewUpdater.updateCollection()
      void loadSelectedPackageDetails()
      viewUpdater.setStatus(
        response.results.length > 0
          ? `${response.results.length} packages found`
          : `No packages found for "${truncateText(trimmed, 48)}"`,
        response.results.length > 0 ? 'success' : 'warning',
      )
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error) || currentRequestId !== requestId) {
        return
      }

      stopSpinner()
      state.searchStatus = 'error'
      state.errorMessage = error instanceof Error ? error.message : String(error)
      viewUpdater.updateCollection()
      viewUpdater.setStatus('Package search failed', 'danger')
    }
  }

  function scheduleSearch(): void {
    state.query = input.value
    state.pageOffset = 0

    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    const trimmed = state.query.trim()
    if (!trimmed) {
      void runSearch(state.query, 0)
      return
    }

    stopSpinner()
    state.searchStatus = 'debouncing'
    viewUpdater.updateCollectionTitle()
    viewUpdater.updateStatusBar()

    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      void runSearch(state.query, 0)
    }, SEARCH_DEBOUNCE_MS)
  }

  input.on(InputRenderableEvents.INPUT, scheduleSearch)

  function handleAppKey(key: KeyEvent): boolean {
    if (state.focus !== 'search' && isPlainKey(key, '/')) {
      focusSearch()
      return true
    }

    if (isPlainKey(key, 'escape')) {
      if (state.focus === 'search') {
        return focusResultsFromSearch()
      }

      if (state.focus === 'collection') {
        focusSearch()
        return true
      }

      return showCollection()
    }

    if (state.focus === 'search') {
      if (isPlainKey(key, 'return')) {
        return focusResultsFromSearch('first')
      }

      if (isPlainKey(key, 'down')) {
        return focusResultsFromSearch('first')
      }

      if (isPlainKey(key, 'up')) {
        return focusResultsFromSearch('last')
      }

      if (isPlainKey(key, '[') || isCtrlKey(key, 'u')) {
        return pageResults('previous')
      }

      if (isPlainKey(key, ']') || isCtrlKey(key, 'd')) {
        return pageResults('next')
      }

      return false
    }

    if (isPlainKey(key, 'h') || isPlainKey(key, 'left')) {
      if (state.focus === 'inspector') {
        focusCollection()
      } else {
        focusSearch()
      }
      return true
    }

    if (isPlainKey(key, 'return')) {
      openSelection()
      return true
    }

    if (isPlainKey(key, 'l') || isPlainKey(key, 'right')) {
      return focusInspector()
    }

    if (isPlainKey(key, '[') || isCtrlKey(key, 'u')) {
      return pageResults('previous')
    }

    if (isPlainKey(key, ']') || isCtrlKey(key, 'd')) {
      return pageResults('next')
    }

    if (isPlainKey(key, 'j') || isPlainKey(key, 'down')) {
      if (state.focus === 'inspector') {
        scrollInspector('down')
      } else {
        moveSelection('down')
      }
      return true
    }

    if (isPlainKey(key, 'k') || isPlainKey(key, 'up')) {
      if (state.focus === 'inspector') {
        scrollInspector('up')
      } else {
        moveSelection('up')
      }
      return true
    }

    return false
  }

  const modeHandler = (key: KeyEvent): void => {
    if (!handleAppKey(key)) {
      return
    }

    key.preventDefault()
    key.stopPropagation()
  }

  const quitHandler = (key: KeyEvent): void => {
    if (!shouldQuit(key, state)) {
      return
    }

    key.preventDefault()
    key.stopPropagation()
    renderer.destroy()
  }

  renderer.keyInput.on('keypress', quitHandler)
  renderer.keyInput.on('keypress', modeHandler)
  renderer.on(CliRenderEvents.RESIZE, viewUpdater.applyLayout)

  function applyTheme(nextTheme: Theme): void {
    theme = nextTheme

    applyThemeToView({
      renderer,
      view: appThemeView,
      state,
      theme,
      createCollectionListText,
      createResultsFooterText,
      updateInspector: viewUpdater.updateInspector,
    })
  }

  applyTheme(theme)
  themeManager.subscribe(applyTheme)
  renderer.on(CliRenderEvents.DESTROY, () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    stopSpinner()
    activeRequest?.abort()
    input.off(InputRenderableEvents.INPUT, scheduleSearch)
    renderer.keyInput.off('keypress', modeHandler)
    renderer.keyInput.off('keypress', quitHandler)
    renderer.off(CliRenderEvents.RESIZE, viewUpdater.applyLayout)
    themeManager.dispose()
  })

  renderer.root.add(shell)
  viewUpdater.applyLayout()
  viewUpdater.updateCollection()
  focusSearch()
}

export { createThemeManager }
export type { RunTuiOptions } from './app/types.ts'
export type { Theme, ThemeManager, ThemeMode, ThemeName, ThemePreference } from './theme/index.ts'
