import { parseFragment } from 'parse5'
import { fromParse5 } from 'hast-util-from-parse5'
import { toMdast } from 'hast-util-to-mdast'
import { toMarkdown as mdastToMarkdown } from 'mdast-util-to-markdown'
import { gfmTableToMarkdown } from 'mdast-util-gfm-table'

export interface HtmlToMarkdownOptions {
  /** Whether to pad table columns to equal width (default: `true`). */
  tablePipeAlign?: boolean
}

/**
 * Convert an HTML string to Markdown
 */
export function htmlToMarkdown(html: string, options: HtmlToMarkdownOptions = {}): string {
  const { tablePipeAlign = true } = options
  const dom = parseFragment(html)
  const hast = fromParse5(dom)
  const mdast = toMdast(hast)
  return mdastToMarkdown(mdast, { extensions: [gfmTableToMarkdown({ tablePipeAlign })] })
}
