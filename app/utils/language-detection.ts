/**
 * Guess the programming language from a file path for syntax highlighting.
 * NOTE: We aren't using this for any other language besides JS/TS/JSON.
 */
export function guessLanguageFromPath(filePath: string): string {
  const fileName = filePath.split('/').pop() || ''
  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  // Extension-based mapping
  const extMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
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

    // Data/Config
    json: 'json',
    jsonc: 'jsonc',
    json5: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    svg: 'xml',

    // Documentation
    md: 'markdown',
    mdx: 'markdown',
    txt: 'text',

    // Shell
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',

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

  // Special filename mapping
  const filenameMap: Record<string, string> = {
    Dockerfile: 'dockerfile',
    Makefile: 'makefile',
  }

  if (filenameMap[fileName]) {
    return filenameMap[fileName]
  }

  return extMap[ext] || 'text'
}
