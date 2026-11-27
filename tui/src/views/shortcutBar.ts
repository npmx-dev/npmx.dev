import { StyledText, bold, fg, type TextChunk } from '@opentui/core'
import { STATUS_BAR_PADDING_X } from '../app/constants.ts'
import type { AppState, ShortcutAction } from '../app/types.ts'
import type { Theme } from '../theme/index.ts'

function contextActions(state: AppState): ShortcutAction[] {
  if (state.focus === 'search') {
    return [
      { key: 'type', label: 'Search' },
      { key: 'enter', label: 'Results' },
      { key: '↑/↓', label: 'Results' },
      { key: 'esc', label: 'Cancel' },
    ]
  }

  if (state.layout === 'single' && state.view === 'inspector') {
    return [
      { key: 'h/esc', label: 'Results' },
      { key: 'j/k', label: 'Scroll' },
      { key: '/', label: 'Search' },
      { key: 'q', label: 'Quit' },
    ]
  }

  if (state.focus === 'inspector') {
    return [
      { key: 'h', label: 'Results' },
      { key: 'j/k', label: 'Scroll' },
      { key: '/', label: 'Search' },
      { key: 'q', label: 'Quit' },
    ]
  }

  return [
    { key: 'j/k', label: 'Navigate' },
    { key: '[/]', label: 'Page' },
    { key: 'l', label: 'Details' },
    { key: 'enter', label: 'Preview' },
    { key: '/', label: 'Search' },
    { key: 'q', label: 'Quit' },
  ]
}

export function createShortcutBarText(state: AppState, theme: Theme, width = 0): StyledText {
  const chunks: TextChunk[] = []
  const actions = contextActions(state)
  const brand = './npmx'
  const padding = ' '.repeat(STATUS_BAR_PADDING_X)
  const availableWidth = Math.max(0, width - STATUS_BAR_PADDING_X * 2)
  const shortcutsLength = actions.reduce(
    (length, action, index) =>
      length + (index > 0 ? 3 : 0) + action.key.length + 1 + action.label.length,
    0,
  )

  chunks.push(fg(theme.fg.muted)(padding))

  actions.forEach((action, index) => {
    if (index > 0) {
      chunks.push(fg(theme.fg.muted)('   '))
    }

    chunks.push(fg(theme.accent)(bold(action.key)))
    chunks.push(fg(theme.fg.secondary)(` ${action.label}`))
  })

  const spacerWidth = availableWidth - shortcutsLength - brand.length
  chunks.push(fg(theme.fg.muted)(spacerWidth > 0 ? ' '.repeat(spacerWidth) : '   '))
  chunks.push(fg(theme.fg.primary)(bold(brand)))
  chunks.push(fg(theme.fg.muted)(padding))

  return new StyledText(chunks)
}
