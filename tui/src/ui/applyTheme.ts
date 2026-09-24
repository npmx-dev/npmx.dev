import type {
  BoxRenderable,
  CliRenderer,
  InputRenderable,
  StyledText,
  TextRenderable,
} from '@opentui/core'
import type { AppState } from '../app/types.ts'
import type { Theme } from '../theme/index.ts'

export interface AppThemeView {
  shell: BoxRenderable
  searchPanel: BoxRenderable
  inputRow: BoxRenderable
  workspace: BoxRenderable
  leftPane: BoxRenderable
  collectionPane: BoxRenderable
  inspectorPane: BoxRenderable
  prompt: TextRenderable
  input: InputRenderable
  spinner: TextRenderable
  collectionList: TextRenderable
  inspector: TextRenderable
  resultsFooter: TextRenderable
  statusBar: TextRenderable
}

interface ApplyThemeOptions {
  renderer: CliRenderer
  view: AppThemeView
  state: AppState
  theme: Theme
  createCollectionListText: (
    state: AppState,
    theme: Theme,
    width: number,
    height: number,
  ) => StyledText
  createResultsFooterText: (state: AppState, theme: Theme) => StyledText
  updateInspector: () => void
}

export function applyThemeToView({
  renderer,
  view,
  state,
  theme,
  createCollectionListText,
  createResultsFooterText,
  updateInspector,
}: ApplyThemeOptions): void {
  renderer.setBackgroundColor(theme.bg.base)

  view.shell.backgroundColor = theme.bg.base
  view.searchPanel.backgroundColor = theme.bg.base
  view.searchPanel.focusedBorderColor = theme.border.focused
  view.inputRow.backgroundColor = theme.bg.base
  view.workspace.backgroundColor = theme.bg.base
  view.leftPane.backgroundColor = theme.bg.base
  view.collectionPane.backgroundColor = theme.bg.base
  view.collectionPane.focusedBorderColor = theme.border.focused
  view.inspectorPane.backgroundColor = theme.bg.base
  view.inspectorPane.focusedBorderColor = theme.border.focused

  view.prompt.fg = theme.accent
  view.prompt.bg = theme.bg.base
  view.input.backgroundColor = theme.bg.base
  view.input.textColor = theme.fg.primary
  view.input.placeholderColor = theme.fg.muted
  view.input.focusedTextColor = theme.fg.primary
  view.input.focusedBackgroundColor = theme.bg.base
  view.input.cursorColor = theme.accent
  view.spinner.fg = theme.accent
  view.spinner.bg = theme.bg.base

  view.collectionList.fg = theme.fg.secondary
  view.collectionList.bg = theme.bg.base
  view.collectionList.content = createCollectionListText(
    state,
    theme,
    Math.max(1, Number(view.collectionList.width) || 80),
    Math.max(1, Number(view.collectionList.height) || 12),
  )

  view.inspector.fg = theme.fg.secondary
  view.inspector.bg = theme.bg.base
  view.resultsFooter.bg = theme.bg.base
  view.resultsFooter.content = createResultsFooterText(state, theme)
  view.statusBar.bg = theme.bg.base
  view.statusBar.fg = theme.status[state.statusKind]
  updateInspector()
}
