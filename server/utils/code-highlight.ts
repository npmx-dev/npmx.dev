// File extension to language mapping
const EXTENSION_MAP: Record<string, string> = {
  // JavaScript/TypeScript
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',

  // Web
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',

  // Data formats
  json: 'json',
  jsonc: 'jsonc',
  json5: 'jsonc',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  svg: 'xml',

  // Shell
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',

  // Docs
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',

  // Other languages
  py: 'python',
  rs: 'rust',
  go: 'go',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  diff: 'diff',
  patch: 'diff',
}

// Special filenames that have specific languages
const FILENAME_MAP: Record<string, string> = {
  '.gitignore': 'bash',
  '.npmignore': 'bash',
  '.editorconfig': 'toml',
  '.prettierrc': 'json',
  '.eslintrc': 'json',
  'tsconfig.json': 'jsonc',
  'jsconfig.json': 'jsonc',
  'package.json': 'json',
  'package-lock.json': 'json',
  'pnpm-lock.yaml': 'yaml',
  'yarn.lock': 'yaml',
  'Makefile': 'bash',
  'Dockerfile': 'bash',
  'LICENSE': 'text',
  'CHANGELOG': 'markdown',
  'CHANGELOG.md': 'markdown',
  'README': 'markdown',
  'README.md': 'markdown',
}

/**
 * Determine the language for syntax highlighting based on file path
 */
export function getLanguageFromPath(filePath: string): string {
  const filename = filePath.split('/').pop() || ''

  // Check for exact filename match first
  if (FILENAME_MAP[filename]) {
    return FILENAME_MAP[filename]
  }

  // Then check extension
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return EXTENSION_MAP[ext] || 'text'
}

/**
 * Highlight code using Shiki with line-by-line output for line highlighting.
 * Each line is wrapped in a span.line for individual line highlighting.
 */
export async function highlightCode(code: string, language: string): Promise<string> {
  const shiki = await getShikiHighlighter()
  const loadedLangs = shiki.getLoadedLanguages()

  // Use Shiki if language is loaded
  if (loadedLangs.includes(language as never)) {
    try {
      const html = shiki.codeToHtml(code, {
        lang: language,
        theme: 'github-dark',
      })

      // Check if Shiki already outputs .line spans (newer versions do)
      if (html.includes('<span class="line">')) {
        // Shiki already wraps lines, but they're separated by newlines
        // We need to remove the newlines since display:block handles line breaks
        // Replace newlines between </span> and <span class="line"> with nothing
        return html.replace(/<\/span>\n<span class="line">/g, '</span><span class="line">')
      }

      // Older Shiki without .line spans - wrap manually
      const codeMatch = html.match(/<code[^>]*>([\s\S]*)<\/code>/)
      if (codeMatch?.[1]) {
        const codeContent = codeMatch[1]
        const lines = codeContent.split('\n')
        const wrappedLines = lines.map((line: string, i: number) => {
          if (i === lines.length - 1 && line === '') return null
          return `<span class="line">${line}</span>`
        }).filter((line: string | null): line is string => line !== null).join('')

        return html.replace(codeMatch[1], wrappedLines)
      }

      return html
    }
    catch {
      // Fall back to plain
    }
  }

  // Plain code for unknown languages - also wrap lines
  const lines = code.split('\n')
  const wrappedLines = lines.map((line) => {
    const escaped = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<span class="line">${escaped}</span>`
  }).join('') // No newlines - display:block handles it

  return `<pre class="shiki github-dark"><code>${wrappedLines}</code></pre>`
}
