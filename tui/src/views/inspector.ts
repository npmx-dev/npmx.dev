import { StyledText, bold, fg, type TextChunk } from '@opentui/core'
import {
  compactList,
  createField,
  createInlineMeta,
  formatBytes,
  formatDate,
  formatDownloads,
  formatRecord,
  isDefinedString,
  truncateText,
} from '../app/format.ts'
import type { DetailStatus, InspectorLine } from '../app/types.ts'
import type { PackageDetails, PackageSearchResult } from '../search.ts'
import type { Theme } from '../theme/index.ts'

function createBracketSection(title: string, lines: string[]): InspectorLine[] {
  const body = lines.filter(Boolean)

  if (body.length === 0) {
    return []
  }

  return [{ text: title, tone: 'section' }, ...body.map(line => ({ text: `  ${line}` }))]
}

function createInstallBlock(packageName: string): InspectorLine[] {
  return createBracketSection('install', [
    `npm install ${packageName}`,
    `pnpm add ${packageName}`,
    `yarn add ${packageName}`,
    `bun add ${packageName}`,
  ]).map(line =>
    line.tone === 'section' ? line : ({ ...line, tone: 'command' } satisfies InspectorLine),
  )
}

export function createInspectorLines(
  pkg: PackageSearchResult | undefined,
  detail?: PackageDetails,
  detailStatus: DetailStatus = 'idle',
  detailError?: string,
): InspectorLine[] {
  if (!pkg) {
    return [
      { text: 'Package preview', tone: 'title' },
      { text: '' },
      {
        text: 'Select a package from the collection to inspect the details available from search.',
        tone: 'muted',
      },
    ]
  }

  const data = detail ?? pkg
  const linkRows: Array<[string, string]> = []
  if (data.links?.npm) {
    linkRows.push(['npm', data.links.npm])
  }
  if (data.links?.repository) {
    linkRows.push(['repo', data.links.repository])
  }
  if (data.links?.homepage) {
    linkRows.push(['home', data.links.homepage])
  }
  if (data.links?.bugs) {
    linkRows.push(['bugs', data.links.bugs])
  }

  const links = linkRows
    .map(([label, value]) => createField(label, truncateText(value, 72)))
    .filter(isDefinedString)
  const keywords = compactList(data.keywords, 10)
  const maintainers = data.maintainers
    .map(maintainer => maintainer.username ?? maintainer.name)
    .filter(isDefinedString)
  const author = detail?.author?.name ?? detail?.author?.username
  const distTags = formatRecord(detail?.distTags, 5)
  const engineInfo = formatRecord(detail?.entryPoints?.engines, 3)
  const binNames = detail?.entryPoints?.binNames ?? []
  const detailStatusLine =
    detailStatus === 'loading'
      ? ({ text: '  Loading registry metadata...', tone: 'muted' } satisfies InspectorLine)
      : detailStatus === 'error'
        ? ({
            text: `  Detail metadata unavailable: ${truncateText(detailError ?? 'request failed', 72)}`,
            tone: 'warning',
          } satisfies InspectorLine)
        : undefined
  const summaryMeta = createInlineMeta([
    `latest v${data.version}`,
    formatDownloads(data.weeklyDownloads),
    data.license,
    detail?.unpackedSize ? formatBytes(detail.unpackedSize) : undefined,
  ])
  const headerBlock: InspectorLine[] = [{ text: data.name, tone: 'title' }, { text: '' }]
  if (detail?.deprecated) {
    headerBlock.push({ text: `deprecated: ${detail.deprecated}`, tone: 'warning' })
  }
  if (summaryMeta) {
    headerBlock.push({ text: summaryMeta, tone: 'muted' })
  }
  headerBlock.push({ text: data.description })
  if (detailStatusLine) {
    headerBlock.push(detailStatusLine)
  }

  const healthRows = [
    createField('downloads', formatDownloads(data.weeklyDownloads)),
    createField('versions', detail?.versionCount),
    createField('maintainers', maintainers.length),
    detail?.entryPoints?.dependenciesCount !== undefined
      ? createField('dependencies', detail.entryPoints.dependenciesCount)
      : undefined,
    detail?.entryPoints?.peerDependenciesCount !== undefined
      ? createField('peer deps', detail.entryPoints.peerDependenciesCount)
      : undefined,
    createField('published', detail?.date ? formatDate(detail.date) : undefined),
    createField('created', detail?.created ? formatDate(detail.created) : undefined),
    createField('modified', detail?.modified ? formatDate(detail.modified) : undefined),
    createField('dist-tags', distTags),
  ].filter(isDefinedString)

  const runtimeRows = [
    createField('type', detail?.entryPoints?.type),
    createField('main', detail?.entryPoints?.main),
    createField('module', detail?.entryPoints?.module),
    createField('types', detail?.entryPoints?.types),
    detail?.entryPoints?.hasExports !== undefined
      ? createField('exports', detail.entryPoints.hasExports ? 'yes' : 'no')
      : undefined,
    createField('bin', binNames.length > 0 ? compactList(binNames, 5) : undefined),
    createField('engines', engineInfo),
  ].filter(isDefinedString)

  const blocks: InspectorLine[][] = [
    headerBlock,
    createInstallBlock(data.name),
    createBracketSection('health', healthRows),
    createBracketSection('runtime', runtimeRows),
    createBracketSection('links', links),
    createBracketSection('keywords', keywords ? [keywords] : []),
    createBracketSection(
      'maintainers',
      [
        createField('author', author),
        createField('team', maintainers.length > 0 ? compactList(maintainers, 8) : undefined),
      ].filter(isDefinedString),
    ),
  ].filter(block => block.length > 0)

  return blocks.flatMap((block, index) => (index === 0 ? block : [{ text: '' }, ...block]))
}

export function createScrollableLines(
  lines: InspectorLine[],
  offset: number,
  viewportHeight: number,
): InspectorLine[] {
  const visibleHeight = Math.max(1, viewportHeight)

  if (lines.length <= visibleHeight) {
    return lines
  }

  const bodyHeight = Math.max(1, visibleHeight - 1)
  const start = Math.min(offset, Math.max(0, lines.length - bodyHeight))
  const end = Math.min(lines.length, start + bodyHeight)
  const indicator = `-- ${start + 1}-${end}/${lines.length} --`

  return [...lines.slice(start, end), { text: indicator, tone: 'muted' }]
}

export function getMaxInspectorScrollOffset(
  lines: InspectorLine[],
  viewportHeight: number,
): number {
  const bodyHeight =
    lines.length > viewportHeight ? Math.max(1, viewportHeight - 1) : viewportHeight

  return Math.max(0, lines.length - bodyHeight)
}

export function createStyledInspectorText(lines: InspectorLine[], theme: Theme): StyledText {
  const chunks: TextChunk[] = []

  lines.forEach((line, index) => {
    const text = index === lines.length - 1 ? line.text : `${line.text}\n`

    if (line.tone === 'title') {
      chunks.push(fg(theme.fg.primary)(bold(text)))
      return
    }

    if (line.tone === 'section') {
      const newline = index === lines.length - 1 ? '' : '\n'
      chunks.push(fg(theme.accent)(bold('[')))
      chunks.push(fg(theme.fg.primary)(bold(line.text)))
      chunks.push(fg(theme.accent)(bold(']')))
      if (newline) {
        chunks.push(fg(theme.fg.muted)(newline))
      }
      return
    }

    if (line.tone === 'muted') {
      chunks.push(fg(theme.fg.muted)(text))
      return
    }

    if (line.tone === 'command') {
      chunks.push(fg(theme.status.success)(text))
      return
    }

    if (line.tone === 'warning') {
      chunks.push(fg(theme.status.warning)(text))
      return
    }

    if (line.tone === 'danger') {
      chunks.push(fg(theme.status.danger)(text))
      return
    }

    chunks.push({
      __isChunk: true,
      text,
    })
  })

  return new StyledText(chunks)
}
