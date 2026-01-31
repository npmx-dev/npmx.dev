import { isBuiltin } from 'node:module'
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
  gjs: 'glimmer-js',
  gts: 'glimmer-ts',

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
  'README.markdown': 'markdown',
}

/**
 * Determine the language for syntax highlighting based on file path
 * @public
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
 * Check if a module specifier is an npm package (not a relative/absolute path or Node built-in)
 */
function isNpmPackage(specifier: string): boolean {
  // Remove quotes
  const pkg = specifier.replace(/^['"]|['"]$/g, '').trim()
  // Relative or absolute paths
  if (pkg.startsWith('.') || pkg.startsWith('/')) return false
  // Node built-ins with node: prefix
  if (pkg.startsWith('node:')) return false
  // Node built-ins without prefix
  if (isBuiltin(pkg)) return false
  // Empty
  if (!pkg) return false
  return true
}

/**
 * Extract the package name from a module specifier (handles scoped packages and subpaths)
 */
function getPackageName(specifier: string): string {
  const pkg = specifier.replace(/^['"]|['"]$/g, '').trim()
  // Scoped package: @scope/name or @scope/name/subpath
  if (pkg.startsWith('@')) {
    const parts = pkg.split('/')
    if (parts[0] && parts[1]) {
      return `${parts[0]}/${parts[1]}`
    }
  }
  // Regular package: name or name/subpath
  const firstSlash = pkg.indexOf('/')
  if (firstSlash > 0) {
    return pkg.substring(0, firstSlash)
  }
  return pkg
}

/**
 * Resolved dependency info for linking imports to specific versions
 */
export interface ResolvedDependency {
  version: string
}

/**
 * Map of package name to resolved version for import linking
 */
export type DependencyVersions = Record<string, ResolvedDependency>

/**
 * Function to resolve relative imports to URLs
 */
export type RelativeImportResolver = (specifier: string) => string | null

interface LinkifyOptions {
  dependencies?: DependencyVersions
  resolveRelative?: RelativeImportResolver
}

/**
 * Make import/export module specifiers clickable links to package code browser.
 * Handles:
 * - import ... from 'package'
 * - export ... from 'package'
 * - import 'package' (side-effect imports)
 * - require('package')
 * - import('package') - dynamic imports
 * - Relative imports (./foo, ../bar) when resolver is provided
 *
 * @param html - The HTML to process
 * @param options - Dependencies map and optional relative import resolver
 */
function linkifyImports(html: string, options?: LinkifyOptions): string {
  const { dependencies, resolveRelative } = options ?? {}

  const getHref = (moduleSpecifier: string): string | null => {
    const cleanSpec = moduleSpecifier.replace(/^['"]|['"]$/g, '').trim()

    // Try relative import resolution first
    if (cleanSpec.startsWith('.') && resolveRelative) {
      return resolveRelative(moduleSpecifier)
    }

    // Not a relative import - check if it's an npm package
    if (!isNpmPackage(moduleSpecifier)) {
      return null
    }

    const packageName = getPackageName(moduleSpecifier)
    const dep = dependencies?.[packageName]
    if (dep) {
      // Link to code browser with resolved version
      return `/code/${packageName}/v/${dep.version}`
    }
    // Fall back to package page if not a known dependency
    return `/${packageName}`
  }

  // Match: from keyword span followed by string span containing module specifier
  // Pattern: <span style="...">from</span><span style="..."> 'module'</span>
  let result = html.replace(
    /(<span[^>]*>from<\/span>)(<span[^>]*>) (['"][^'"]+['"])<\/span>/g,
    (match, fromSpan, stringSpanOpen, moduleSpecifier) => {
      const href = getHref(moduleSpecifier)
      if (!href) return match
      return `${fromSpan}${stringSpanOpen} <a href="${href}" class="import-link">${moduleSpecifier}</a></span>`
    },
  )

  // Match: side-effect imports like `import 'package'`
  // Pattern: <span>import</span><span> 'module'</span>
  // But NOT: import ... from, import(, or import {
  result = result.replace(
    /(<span[^>]*>import<\/span>)(<span[^>]*>) (['"][^'"]+['"])<\/span>/g,
    (match, importSpan, stringSpanOpen, moduleSpecifier) => {
      const href = getHref(moduleSpecifier)
      if (!href) return match
      return `${importSpan}${stringSpanOpen} <a href="${href}" class="import-link">${moduleSpecifier}</a></span>`
    },
  )

  // Match: require( or import( followed by string
  // Pattern: <span> require</span><span>(</span><span>'module'</span>
  // or: <span>import</span><span>(</span><span>'module'</span>
  // Note: require often has a leading space in the span from Shiki
  result = result.replace(
    /(<span[^>]*>)(\s*)(require|import)(<\/span>)(<span[^>]*>\(<\/span>)(<span[^>]*>)(['"][^'"]+['"])<\/span>/g,
    (
      match,
      spanOpen,
      whitespace,
      keyword,
      spanClose,
      parenSpan,
      stringSpanOpen,
      moduleSpecifier,
    ) => {
      const href = getHref(moduleSpecifier)
      if (!href) return match
      return `${spanOpen}${whitespace}${keyword}${spanClose}${parenSpan}${stringSpanOpen}<a href="${href}" class="import-link">${moduleSpecifier}</a></span>`
    },
  )

  return result
}

// Languages that support import/export statements
const IMPORT_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'vue',
  'svelte',
  'astro',
])

export interface HighlightOptions {
  /** Map of dependency names to resolved versions for import linking */
  dependencies?: DependencyVersions
  /** Resolver function for relative imports (./foo, ../bar) */
  resolveRelative?: RelativeImportResolver
}

/**
 * Highlight code using Shiki with line-by-line output for line highlighting.
 * Each line is wrapped in a span.line for individual line highlighting.
 * @public
 */
export async function highlightCode(
  code: string,
  language: string,
  options?: HighlightOptions,
): Promise<string> {
  const shiki = await getShikiHighlighter()
  const loadedLangs = shiki.getLoadedLanguages()

  // Use Shiki if language is loaded
  if (loadedLangs.includes(language as never)) {
    try {
      let html = shiki.codeToHtml(code, {
        lang: language,
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: 'dark',
      })

      // Shiki doesn't encode > in text content (e.g., arrow functions)
      html = escapeRawGt(html)

      // Make import statements clickable for JS/TS languages
      if (IMPORT_LANGUAGES.has(language)) {
        html = linkifyImports(html, {
          dependencies: options?.dependencies,
          resolveRelative: options?.resolveRelative,
        })
      }

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
        const wrappedLines = lines
          .map((line: string, i: number) => {
            if (i === lines.length - 1 && line === '') return null
            return `<span class="line">${line}</span>`
          })
          .filter((line: string | null): line is string => line !== null)
          .join('')

        return html.replace(codeMatch[1], wrappedLines)
      }

      return html
    } catch {
      // Fall back to plain
    }
  }

  // Plain code for unknown languages - also wrap lines
  const lines = code.split('\n')
  const wrappedLines = lines
    .map(line => {
      const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return `<span class="line">${escaped}</span>`
    })
    .join('') // No newlines - display:block handles it

  return `<pre class="shiki github-dark"><code>${wrappedLines}</code></pre>`
}
