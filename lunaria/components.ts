import {
  type createLunaria,
  type Locale,
  type LunariaConfig,
  type LunariaStatus,
  type StatusEntry,
} from '@lunariajs/core'
import { BaseStyles, CustomStyles } from './styles.ts'

export function html(
  strings: TemplateStringsArray,
  ...values: ((string | number) | (string | number)[])[]
) {
  const treatedValues = values.map(value => (Array.isArray(value) ? value.join('') : value))

  return String.raw({ raw: strings }, ...treatedValues)
}

type LunariaInstance = Awaited<ReturnType<typeof createLunaria>>

function collapsePath(path: string) {
  const basesToHide = ['src/content/docs/en/', 'src/i18n/en/', 'src/content/docs/', 'src/content/']

  for (const base of basesToHide) {
    const newPath = path.replace(base, '')

    if (newPath === path) continue
    return newPath
  }

  return path
}

export const Page = (
  config: LunariaConfig,
  status: LunariaStatus,
  lunaria: LunariaInstance,
): string => {
  return html`
		<!doctype html>
		<html dir="ltr" lang="en">
			<head>
				${Meta} ${BaseStyles} ${CustomStyles}
			</head>
			<body>
				${Body(config, status, lunaria)}
			</body>
		</html>
	`
}

export const Meta = html`
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1" />
	<title>npmx - Translation Status</title>
	<meta
		name="description"
		content="Translation progress tracker for the npmx site. See how much has been translated in your language and get involved!"
	/>
	<meta property="last-build" content="${new Date(Date.now()).toString()}" />
	<link rel="canonical" href="https://i18n.npmx.dev/" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&display=swap" rel="stylesheet">
	<meta property="og:title" content="npmx - Translation Status" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://i18n.npmx.dev/" />
	<meta
		property="og:description"
		content="Translation progress tracker for the npmx site. See how much has been translated in your language and get involved!"
	/>
	<link rel="icon" href="https://npmx.dev/favicon.ico" type="image/x-icon" />
	<link rel="icon" href="https://npmx.dev/favicon.svg" type="image/svg+xml" />
`

export const Body = (
  config: LunariaConfig,
  status: LunariaStatus,
  lunaria: LunariaInstance,
): string => {
  return html`
		<main>
			<div class="limit-to-viewport">
				<h1>npmx Translation Status</h1>
				${TitleParagraph} ${StatusByLocale(config, status, lunaria)}
			</div>
			${StatusByFile(config, status, lunaria)}
		</main>
	`
}

export const StatusByLocale = (
  config: LunariaConfig,
  status: LunariaStatus,
  lunaria: LunariaInstance,
): string => {
  const { locales } = config
  return html`
		<h2 id="by-locale">
			<a href="#by-locale">Translation progress by locale</a>
		</h2>
		${locales.map(locale => LocaleDetails(status, locale, lunaria))}
	`
}

export const LocaleDetails = (
  status: LunariaStatus,
  locale: Locale,
  lunaria: LunariaInstance,
): string => {
  const { label, lang } = locale

  const missingFiles = status.filter(
    file =>
      file.localizations.find(localization => localization.lang === lang)?.status === 'missing',
  )
  const outdatedFiles = status.filter(file => {
    const localization = file.localizations.find(localization => localization.lang === lang)

    if (!localization || localization.status === 'missing') return false
    if (file.type === 'dictionary')
      return 'missingKeys' in localization ? localization.missingKeys.length > 0 : false

    return (
      localization.status === 'outdated' ||
      ('missingKeys' in localization && localization.missingKeys.length > 0)
    )
  })

  const doneLength = status.length - outdatedFiles.length - missingFiles.length

  const links = lunaria.gitHostingLinks()

  return html`
		<details class="progress-details">
			<summary>
				<strong>${label} (${lang})</strong>
				<br />
				<span class="progress-summary">
					${doneLength.toString()} done, ${outdatedFiles.length.toString()} outdated,
					${missingFiles.length.toString()} missing
				</span>
				<br />
				${ProgressBar(status.length, outdatedFiles.length, missingFiles.length)}
			</summary>
			${outdatedFiles.length > 0 ? OutdatedFiles(outdatedFiles, lang, lunaria) : ''}
			${
        missingFiles.length > 0
          ? html`<h3 class="capitalize">Missing</h3>
						<ul>
							${missingFiles.map(file => {
                const localization = file.localizations.find(
                  localization => localization.lang === lang,
                )!
                return html`
									<li>
										${Link(links.source(file.source.path), collapsePath(file.source.path))}
										${CreateFileLink(links.create(localization.path), 'Create file')}
									</li>
								`
              })}
						</ul>`
          : ''
      }
			${
        missingFiles.length == 0 && outdatedFiles.length == 0
          ? html`
              <p>This translation is complete, amazing job! 🎉</p>
            `
          : ''
      }
		</details>
	`
}

export const OutdatedFiles = (
  outdatedFiles: LunariaStatus,
  lang: string,
  lunaria: LunariaInstance,
): string => {
  return html`
		<h3 class="capitalize">Outdated</h3>
		<ul>
			${outdatedFiles.map(file => {
        const localization = file.localizations.find(localization => localization.lang === lang)!

        const isMissingKeys =
          localization.status !== 'missing' &&
          'missingKeys' in localization &&
          localization.missingKeys.length > 0

        return html`
					<li>
						${
              isMissingKeys
                ? html`
									<details>
										<summary>${ContentDetailsLinks(file, lang, lunaria)}</summary>
										<h4>Missing keys</h4>
										<ul>
											${localization.missingKeys.map(key => html`<li>${(key as unknown as string[]).join('.')}</li>`)}
										</ul>
									</details>
								`
                : html` ${ContentDetailsLinks(file, lang, lunaria)} `
            }
					</li>
				`
      })}
		</ul>
	`
}

export const StatusByFile = (
  config: LunariaConfig,
  status: LunariaStatus,
  lunaria: LunariaInstance,
): string => {
  const { locales } = config
  return html`
		<h2 id="by-file">
			<a href="#by-file">Translation status by file</a>
		</h2>
		<table class="status-by-file">
			<thead>
				<tr>
					${['File', ...locales.map(({ lang }) => lang)].map(col => html`<th>${col}</th>`)}
				</tr>
			</thead>
			${TableBody(status, locales, lunaria)}
		</table>
		<sup class="capitalize">❌ missing &nbsp; 🔄 outdated &nbsp; ✔ done </sup>
	`
}

export const TableBody = (
  status: LunariaStatus,
  locales: Locale[],
  lunaria: LunariaInstance,
): string => {
  const links = lunaria.gitHostingLinks()

  return html`
		<tbody>
			${status.map(
        file =>
          html`
				<tr>
					<td>${Link(links.source(file.source.path), collapsePath(file.source.path))}</td>
						${locales.map(({ lang }) => {
              return TableContentStatus(file.localizations, lang, lunaria)
            })}
					</td>
				</tr>`,
      )}
		</tbody>
	`
}

export const TableContentStatus = (
  localizations: StatusEntry['localizations'],
  lang: string,
  lunaria: LunariaInstance,
): string => {
  const localization = localizations.find(localization => localization.lang === lang)!
  const isMissingKeys = 'missingKeys' in localization && localization.missingKeys.length > 0
  const status = isMissingKeys ? 'outdated' : localization.status
  const links = lunaria.gitHostingLinks()
  const link =
    status === 'missing' ? links.create(localization.path) : links.source(localization.path)
  return html`<td>${EmojiFileLink(link, status)}</td>`
}

export const ContentDetailsLinks = (
  fileStatus: StatusEntry,
  lang: string,
  lunaria: LunariaInstance,
): string => {
  const localization = fileStatus.localizations.find(localization => localization.lang === lang)!
  const isMissingKeys =
    localization.status !== 'missing' &&
    'missingKeys' in localization &&
    localization.missingKeys.length > 0

  const links = lunaria.gitHostingLinks()

  return html`
		${Link(links.source(fileStatus.source.path), collapsePath(fileStatus.source.path))}
		(${Link(
      links.source(localization.path),
      isMissingKeys ? 'incomplete translation' : 'outdated translation',
    )},
		${Link(
      links.history(
        fileStatus.source.path,
        'git' in localization
          ? new Date(localization.git.latestTrackedCommit.date).toISOString()
          : undefined,
      ),
      'source change history',
    )})
	`
}

export const EmojiFileLink = (
  href: string | null,
  type: 'missing' | 'outdated' | 'up-to-date',
): string => {
  const statusTextOpts = {
    'missing': 'missing',
    'outdated': 'outdated',
    'up-to-date': 'done',
  } as const

  const statusEmojiOpts = {
    'missing': '❌',
    'outdated': '🔄',
    'up-to-date': '✔',
  } as const

  return href
    ? html`<a href="${href}" title="${statusTextOpts[type]}">
				<span aria-hidden="true">${statusEmojiOpts[type]}</span>
			</a>`
    : html`<span title="${statusTextOpts[type]}">
				<span aria-hidden="true">${statusEmojiOpts[type]}</span>
			</span>`
}

export const Link = (href: string, text: string): string => {
  return html`<a href="${href}">${text}</a>`
}

export const CreateFileLink = (href: string, text: string): string => {
  return html`<a class="create-button" href="${href}">${text}</a>`
}

export const ProgressBar = (
  total: number,
  outdated: number,
  missing: number,
  { size = 20 }: { size?: number } = {},
): string => {
  const outdatedSize = Math.round((outdated / total) * size)
  const missingSize = Math.round((missing / total) * size)
  const doneSize = size - outdatedSize - missingSize

  const getBlocks = (size: number, type: 'missing' | 'outdated' | 'up-to-date') => {
    const items = []
    for (let i = 0; i < size; i++) {
      items.push(html`<div class="${type}-bar"></div>`)
    }
    return items
  }

  return html`
		<div class="progress-bar" aria-hidden="true">
			${getBlocks(doneSize, 'up-to-date')} ${getBlocks(outdatedSize, 'outdated')}
			${getBlocks(missingSize, 'missing')}
		</div>
	`
}

export const TitleParagraph = html`
  <p>
    If you're interested in helping us translate
    <a href="https://npmx.dev/">npmx.dev</a> into one of the languages listed below, you've come to
    the right place! This auto-updating page always lists all the content that could use your help
    right now.
  </p>
  <p>
    Before starting, please read our
    <a href="https://github.com/npmx-dev/npmx.dev/blob/main/CONTRIBUTING.md#localization-i18n"
      >localization (i18n) guide</a
    >
    to learn about our translation process and how you can get involved.
  </p>
`

/**
 * Build an SVG file showing a summary of each language's translation progress.
 */
export const SvgSummary = (config: LunariaConfig, status: LunariaStatus): string => {
  const localeHeight = 56 // Each locale’s summary is 56px high.
  const svgHeight = localeHeight * Math.ceil(config.locales.length / 2)
  return html`<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 400 ${svgHeight}"
		font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"
	>
		${config.locales
      .map(locale => SvgLocaleSummary(status, locale))
      .sort((a, b) => b.progress - a.progress)
      .map(
        ({ svg }, index) =>
          html`<g transform="translate(${(index % 2) * 215} ${Math.floor(index / 2) * 56})"
						>${svg}</g
					>`,
      )}
	</svg>`
}

function SvgLocaleSummary(
  status: LunariaStatus,
  { label, lang }: Locale,
): { svg: string; progress: number } {
  const missingFiles = status.filter(
    file =>
      file.localizations.find(localization => localization.lang === lang)?.status === 'missing',
  )
  const outdatedFiles = status.filter(file => {
    const localization = file.localizations.find(localization => localization.lang === lang)
    if (!localization || localization.status === 'missing') {
      return false
    } else if (file.type === 'dictionary') {
      return 'missingKeys' in localization ? localization.missingKeys.length > 0 : false
    } else {
      return (
        localization.status === 'outdated' ||
        ('missingKeys' in localization && localization.missingKeys.length > 0)
      )
    }
  })

  const doneLength = status.length - outdatedFiles.length - missingFiles.length
  const barWidth = 184
  const doneFraction = doneLength / status.length
  const outdatedFraction = outdatedFiles.length / status.length
  const doneWidth = (doneFraction * barWidth).toFixed(2)
  const outdatedWidth = ((outdatedFraction + doneFraction) * barWidth).toFixed(2)

  return {
    progress: doneFraction,
    svg: html`<text x="0" y="12" font-size="11" font-weight="600" fill="#999"
				>${label} (${lang})</text
			>
			<text x="0" y="26" font-size="9" fill="#999">
				${
          missingFiles.length == 0 && outdatedFiles.length == 0
            ? '100% complete, amazing job! 🎉'
            : html`${doneLength} done, ${outdatedFiles.length} outdated, ${missingFiles.length}
						missing`
        }
			</text>
			<rect x="0" y="34" width="${barWidth}" height="8" fill="#999" opacity="0.25"></rect>
			<rect x="0" y="34" width="${outdatedWidth}" height="8" fill="#fb923c"></rect>
			<rect x="0" y="34" width="${doneWidth}" height="8" fill="#c084fc"></rect>`,
  }
}
