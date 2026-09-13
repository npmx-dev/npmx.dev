import { StyledText, bg, bold, fg, type TextChunk } from '@opentui/core'
import { LIST_SCROLLBAR_WIDTH } from '../app/constants.ts'
import { formatDownloads, truncateText } from '../app/format.ts'
import { formatResultsRange, hasNextResultsPage } from '../app/selectors.ts'
import type { AppState } from '../app/types.ts'
import type { Theme } from '../theme/index.ts'

function getCollectionEmptyLines(state: AppState): Array<{ title: string; detail: string }> {
  if (!state.query.trim()) {
    return [
      {
        title: 'Search npm packages',
        detail: 'Type a package name to begin.',
      },
    ]
  }

  if (state.searchStatus === 'searching' && state.results.length === 0) {
    return [
      {
        title: 'Searching packages...',
        detail: `Waiting for "${truncateText(state.query, 48)}"`,
      },
    ]
  }

  if (state.searchStatus === 'error' && state.results.length === 0) {
    return [
      {
        title: 'Failed to search packages',
        detail: state.errorMessage ?? 'Network request failed.',
      },
    ]
  }

  if (state.searchStatus === 'empty') {
    return [
      {
        title: `No packages found for "${truncateText(state.query, 42)}"`,
        detail: 'Try a different package name.',
      },
    ]
  }

  return []
}

function getCollectionWindow(state: AppState, height: number): { start: number; end: number } {
  const visibleRows = Math.max(1, height)

  if (state.results.length <= visibleRows) {
    return { start: 0, end: state.results.length }
  }

  const half = Math.floor(visibleRows / 2)
  const start = Math.max(
    0,
    Math.min(state.selectedIndex - half, state.results.length - visibleRows),
  )
  return {
    start,
    end: Math.min(state.results.length, start + visibleRows),
  }
}

function padCell(value: string, width: number, align: 'left' | 'right' = 'left'): string {
  const truncated = truncateText(value, width)
  return align === 'right' ? truncated.padStart(width, ' ') : truncated.padEnd(width, ' ')
}

function createSelectedChunk(text: string, theme: Theme): TextChunk {
  return bg(theme.accent)(fg(theme.bg.base)(text))
}

export function createCollectionListText(
  state: AppState,
  theme: Theme,
  width = 80,
  height = 12,
): StyledText {
  const chunks: TextChunk[] = []
  const rowWidth = Math.max(24, width)
  const emptyLines = getCollectionEmptyLines(state)

  if (emptyLines.length > 0) {
    emptyLines.forEach((line, index) => {
      chunks.push(fg(theme.fg.primary)(bold(truncateText(line.title, rowWidth))))
      chunks.push(fg(theme.fg.muted)(`\n${truncateText(line.detail, rowWidth)}`))
      if (index < emptyLines.length - 1) {
        chunks.push(fg(theme.fg.muted)('\n'))
      }
    })

    return new StyledText(chunks)
  }

  const showScroll = state.results.length > height
  const contentWidth = Math.max(22, rowWidth - (showScroll ? LIST_SCROLLBAR_WIDTH : 0))
  const compact = contentWidth < 56
  const versionWidth = compact ? 0 : 11
  const downloadsWidth = compact ? 8 : 9
  const nameWidth = compact
    ? Math.max(8, contentWidth - 2 - downloadsWidth - 1 - 2)
    : Math.max(16, Math.min(34, Math.floor(contentWidth * 0.34)))
  const fixedWidth =
    2 + nameWidth + 1 + (versionWidth > 0 ? versionWidth + 1 : 0) + downloadsWidth + 2
  const descriptionWidth = Math.max(0, contentWidth - fixedWidth)
  const window = getCollectionWindow(state, height)
  const visibleCount = Math.max(1, window.end - window.start)
  const maxIndicatorY = Math.max(0, visibleCount - 1)
  const indicatorY = showScroll
    ? Math.round((state.selectedIndex / Math.max(1, state.results.length - 1)) * maxIndicatorY)
    : -1

  state.results.slice(window.start, window.end).forEach((result, visibleIndex) => {
    const actualIndex = window.start + visibleIndex
    const selected = actualIndex === state.selectedIndex
    const prefix = selected ? '> ' : '  '
    const version = versionWidth > 0 ? `${padCell(`v${result.version}`, versionWidth)} ` : ''
    const line =
      `${prefix}${padCell(result.name, nameWidth)} ` +
      version +
      `${padCell(formatDownloads(result.weeklyDownloads), downloadsWidth, 'right')}  ` +
      `${truncateText(result.description, descriptionWidth)}`
    const paddedLine = line.padEnd(contentWidth, ' ')
    const scrollbar = showScroll ? (visibleIndex === indicatorY ? '█' : '│') : ''
    const isLast = visibleIndex === visibleCount - 1

    if (selected) {
      chunks.push(createSelectedChunk(paddedLine, theme))
    } else {
      chunks.push(fg(theme.fg.secondary)(prefix))
      chunks.push(fg(theme.fg.primary)(bold(padCell(result.name, nameWidth))))
      chunks.push(fg(theme.fg.muted)(' '))
      if (versionWidth > 0) {
        chunks.push(fg(theme.fg.secondary)(padCell(`v${result.version}`, versionWidth)))
        chunks.push(fg(theme.fg.muted)(' '))
      }
      chunks.push(
        fg(theme.fg.secondary)(
          padCell(formatDownloads(result.weeklyDownloads), downloadsWidth, 'right'),
        ),
      )
      chunks.push(
        fg(theme.fg.muted)(
          `  ${truncateText(result.description, descriptionWidth)}`.padEnd(
            Math.max(0, contentWidth - fixedWidth + 2),
            ' ',
          ),
        ),
      )
    }

    if (showScroll) {
      chunks.push(
        fg(visibleIndex === indicatorY ? theme.accent : theme.border.subtle)(` ${scrollbar}`),
      )
    }

    if (!isLast) {
      chunks.push(fg(theme.fg.muted)('\n'))
    }
  })

  return new StyledText(chunks)
}

export function createResultsFooterText(state: AppState, theme: Theme): StyledText {
  const complete = state.query.trim().length > 0 && state.total > 0 && !hasNextResultsPage(state)
  const rangeColor = complete ? theme.fg.primary : theme.fg.muted

  return new StyledText([fg(theme.fg.muted)('\n'), fg(rangeColor)(formatResultsRange(state))])
}
