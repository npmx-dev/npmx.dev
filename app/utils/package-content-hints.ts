/**
 * Heuristics for identifying files and directories that are commonly shipped
 * to npm by accident: editor configs, lint/format settings, test trees,
 * local-only env files, etc. Used by the package code browser to surface
 * "this is probably bloat" hints next to affected nodes.
 *
 * Source list: https://github.com/npmx-dev/npmx.dev/issues/2582
 */

const POSSIBLY_UNNECESSARY_FILES: ReadonlySet<string> = new Set([
  '.editorconfig',
  '.prettierignore',
  '.eslintignore',
  '.jshintignore',
  '.npmignore',
  '.gitignore',
  '.gitattributes',
  '.travis.yml',
  'Makefile',
  'tsconfig.json',
  '.node-version',
  '.nvmrc',
  'mise.toml',
  '.tool-versions',
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.test',
  '.env.test.local',
  '.env.production.local',
  '.nycrc',
  'nyc.json',
  'AUTHORS',
])

const POSSIBLY_UNNECESSARY_DIRECTORIES: ReadonlySet<string> = new Set([
  '.vscode',
  '.claude',
  '.github',
  '.idea',
  '.zed',
  'test',
  'tests',
  'spec',
  'specs',
  'example',
  'examples',
])

const POSSIBLY_UNNECESSARY_DIRECTORY_PATTERNS: readonly RegExp[] = [/^__.+__$/]

const POSSIBLY_UNNECESSARY_PATTERNS: readonly RegExp[] = [
  /^eslint\.config\.(?:js|cjs|mjs|ts|mts|cts)$/,
  /^\.eslintrc(?:\.(?:json|js|cjs|yml|yaml))?$/,
  /^\.prettierrc(?:\.(?:json|js|cjs|yml|yaml|toml))?$/,
  /^prettier\.config\.(?:js|cjs|mjs|ts|mts|cts)$/,
  /^oxlint\.config\.(?:js|cjs|mjs|ts|mts|cts)$/,
  /^\.oxlintrc(?:\.(?:json|js|cjs|yml|yaml))?$/,
  /^oxfmt\.config\.(?:js|cjs|mjs|ts|mts|cts)$/,
  /^\.oxfmtrc(?:\.(?:json|js|cjs|yml|yaml))?$/,
  // Match common dot-prefixed config files without flagging all dotfiles;
  // files like .npmrc, .npmignore, and .gitkeep can be intentional artifacts.
  /^\.(?!npmrc$)[a-z][a-z0-9_-]*rc$/,
  /^\.(?!npmrc\.)[a-z][a-z0-9_-]*rc\.(?:json|js|cjs|mjs|yml|yaml|toml)$/,
  /^\.[a-z][a-z0-9_-]*\.config\.(?:js|cjs|mjs|ts|mts|cts)$/,
  // Match files ending in .test.js, .test.ts, .spec.js, .spec.ts, etc.
  /(?:test|spec)\.(?:j|t)s$/,
  // Match CHANGELOG.md, etc
  /^(?:changelog|releasenotes|release-notes|history|contributing|contribute)\.(?:md|markdown|txt)$/i,
]

export function isPossiblyUnnecessaryContent(name: string, type: 'file' | 'directory'): boolean {
  if (type === 'directory') {
    if (POSSIBLY_UNNECESSARY_DIRECTORIES.has(name)) return true
    return POSSIBLY_UNNECESSARY_DIRECTORY_PATTERNS.some(pattern => pattern.test(name))
  }
  if (POSSIBLY_UNNECESSARY_FILES.has(name)) return true
  return POSSIBLY_UNNECESSARY_PATTERNS.some(pattern => pattern.test(name))
}
