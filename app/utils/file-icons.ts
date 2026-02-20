/**
 * Get icon class for a file based on its name/extension.
 * Uses vscode-icons and lucide icons.
 *
 * Based on this file, a sprite file (<ORIGIN_URL>/file-tree-sprite.svg) is generated on postinstall
 * @see /scripts/generate-file-tree-sprite.ts
 */

// Extension to icon mapping
// @unocss-include
export const EXTENSION_ICONS: Record<string, string> = {
  // JavaScript/TypeScript
  'js': 'vscode-icons-file-type-js-official',
  'mjs': 'vscode-icons-file-type-js-official',
  'cjs': 'vscode-icons-file-type-js-official',
  'ts': 'vscode-icons-file-type-typescript-official',
  'mts': 'vscode-icons-file-type-typescript-official',
  'cts': 'vscode-icons-file-type-typescript-official',
  'jsx': 'vscode-icons-file-type-reactjs',
  'tsx': 'vscode-icons-file-type-reactts',

  // Web
  'html': 'vscode-icons-file-type-html',
  'htm': 'vscode-icons-file-type-html',
  'css': 'vscode-icons-file-type-css',
  'scss': 'vscode-icons-file-type-scss',
  'sass': 'vscode-icons-file-type-sass',
  'less': 'vscode-icons-file-type-less',
  'styl': 'vscode-icons-file-type-stylus',
  'vue': 'vscode-icons-file-type-vue',
  'svelte': 'vscode-icons-file-type-svelte',
  'astro': 'vscode-icons-file-type-astro',
  'gjs': 'vscode-icons-file-type-glimmer',
  'gts': 'vscode-icons-file-type-glimmer',

  // Config/Data
  'json': 'vscode-icons-file-type-json',
  'jsonc': 'vscode-icons-file-type-json',
  'json5': 'vscode-icons-file-type-json5',
  'yaml': 'vscode-icons-file-type-yaml',
  'yml': 'vscode-icons-file-type-yaml',
  'toml': 'vscode-icons-file-type-toml',
  'xml': 'vscode-icons-file-type-xml',
  'svg': 'vscode-icons-file-type-svg',
  'graphql': 'vscode-icons-file-type-graphql',
  'gql': 'vscode-icons-file-type-graphql',
  'prisma': 'vscode-icons-file-type-prisma',

  // Documentation
  'md': 'vscode-icons-file-type-markdown',
  'mdx': 'vscode-icons-file-type-mdx',
  'txt': 'vscode-icons-file-type-text',
  'rst': 'vscode-icons-file-type-text',
  'pdf': 'vscode-icons-file-type-pdf2',

  // Shell/Scripts
  'sh': 'vscode-icons-file-type-shell',
  'bash': 'vscode-icons-file-type-shell',
  'zsh': 'vscode-icons-file-type-shell',
  'fish': 'vscode-icons-file-type-shell',
  'ps1': 'vscode-icons-file-type-powershell',
  'bat': 'vscode-icons-file-type-bat',
  'cmd': 'vscode-icons-file-type-bat',

  // Programming languages
  'py': 'vscode-icons-file-type-python',
  'pyi': 'vscode-icons-file-type-python',
  'rb': 'vscode-icons-file-type-ruby',
  'go': 'vscode-icons-file-type-go',
  'rs': 'vscode-icons-file-type-rust',
  'java': 'vscode-icons-file-type-java',
  'kt': 'vscode-icons-file-type-kotlin',
  'swift': 'vscode-icons-file-type-swift',
  'c': 'vscode-icons-file-type-c',
  'cpp': 'vscode-icons-file-type-cpp',
  'h': 'vscode-icons-file-type-cheader',
  'hpp': 'vscode-icons-file-type-cppheader',
  'cs': 'vscode-icons-file-type-csharp',
  'php': 'vscode-icons-file-type-php',
  'lua': 'vscode-icons-file-type-lua',
  'luau': 'vscode-icons-file-type-luau',
  'r': 'vscode-icons-file-type-r',
  'sql': 'vscode-icons-file-type-sql',
  'pl': 'vscode-icons-file-type-perl',
  'ex': 'vscode-icons-file-type-elixir',
  'exs': 'vscode-icons-file-type-elixir',
  'erl': 'vscode-icons-file-type-erlang',
  'hs': 'vscode-icons-file-type-haskell',
  'clj': 'vscode-icons-file-type-clojure',
  'scala': 'vscode-icons-file-type-scala',
  'zig': 'vscode-icons-file-type-zig',
  'nim': 'vscode-icons-file-type-nim',
  'v': 'vscode-icons-file-type-vlang',
  'wasm': 'vscode-icons-file-type-wasm',

  // Images
  'png': 'vscode-icons-file-type-image',
  'jpg': 'vscode-icons-file-type-image',
  'jpeg': 'vscode-icons-file-type-image',
  'gif': 'vscode-icons-file-type-image',
  'webp': 'vscode-icons-file-type-image',
  'ico': 'vscode-icons-file-type-image',
  'bmp': 'vscode-icons-file-type-image',

  // Fonts
  'woff': 'vscode-icons-file-type-font',
  'woff2': 'vscode-icons-file-type-font',
  'ttf': 'vscode-icons-file-type-font',
  'otf': 'vscode-icons-file-type-font',
  'eot': 'vscode-icons-file-type-font',

  // Archives
  'zip': 'vscode-icons-file-type-zip',
  'tar': 'vscode-icons-file-type-zip',
  'gz': 'vscode-icons-file-type-zip',
  'tgz': 'vscode-icons-file-type-zip',
  'bz2': 'vscode-icons-file-type-zip',
  '7z': 'vscode-icons-file-type-zip',
  'rar': 'vscode-icons-file-type-zip',

  // Certificates/Keys
  'pem': 'vscode-icons-file-type-cert',
  'crt': 'vscode-icons-file-type-cert',
  'key': 'vscode-icons-file-type-key',

  // Diff/Patch
  'diff': 'vscode-icons-file-type-diff',
  'patch': 'vscode-icons-file-type-diff',

  // Other
  'log': 'vscode-icons-file-type-log',
  'lock': 'vscode-icons-file-type-json',
  'map': 'vscode-icons-file-type-map',
  'wrl': 'vscode-icons-file-type-binary',
  'bin': 'vscode-icons-file-type-binary',
  'node': 'vscode-icons-file-type-node',
}

// Special filenames that have specific icons
export const FILENAME_ICONS: Record<string, string> = {
  // Package managers
  'package.json': 'vscode-icons-file-type-npm',
  'package-lock.json': 'vscode-icons-file-type-npm',
  'pnpm-lock.yaml': 'vscode-icons-file-type-pnpm',
  'pnpm-workspace.yaml': 'vscode-icons-file-type-pnpm',
  'yarn.lock': 'vscode-icons-file-type-yarn',
  '.yarnrc': 'vscode-icons-file-type-yarn',
  '.yarnrc.yml': 'vscode-icons-file-type-yarn',
  'bun.lockb': 'vscode-icons-file-type-bun',
  'bunfig.toml': 'vscode-icons-file-type-bun',
  'deno.json': 'vscode-icons-file-type-deno',
  'deno.jsonc': 'vscode-icons-file-type-deno',

  // TypeScript configs
  'tsconfig.json': 'vscode-icons-file-type-tsconfig',
  'tsconfig.base.json': 'vscode-icons-file-type-tsconfig',
  'tsconfig.build.json': 'vscode-icons-file-type-tsconfig',
  'tsconfig.node.json': 'vscode-icons-file-type-tsconfig',
  'jsconfig.json': 'vscode-icons-file-type-jsconfig',

  // Build tools
  'vite.config.ts': 'vscode-icons-file-type-vite',
  'vite.config.js': 'vscode-icons-file-type-vite',
  'vite.config.mts': 'vscode-icons-file-type-vite',
  'vite.config.mjs': 'vscode-icons-file-type-vite',
  'webpack.config.js': 'vscode-icons-file-type-webpack',
  'webpack.config.ts': 'vscode-icons-file-type-webpack',
  'rollup.config.js': 'vscode-icons-file-type-rollup',
  'rollup.config.ts': 'vscode-icons-file-type-rollup',
  'rollup.config.mjs': 'vscode-icons-file-type-rollup',
  'esbuild.config.js': 'vscode-icons-file-type-esbuild',
  'turbo.json': 'vscode-icons-file-type-turbo',
  'nx.json': 'vscode-icons-file-type-nx',

  // Framework configs
  'nuxt.config.ts': 'vscode-icons-file-type-nuxt',
  'nuxt.config.js': 'vscode-icons-file-type-nuxt',
  'next.config.js': 'vscode-icons-file-type-next',
  'next.config.mjs': 'vscode-icons-file-type-next',
  'next.config.ts': 'vscode-icons-file-type-next',
  'svelte.config.js': 'vscode-icons-file-type-svelte',
  'astro.config.mjs': 'vscode-icons-file-type-astro',
  'astro.config.ts': 'vscode-icons-file-type-astro',
  'remix.config.js': 'vscode-icons-file-type-js-official',
  'angular.json': 'vscode-icons-file-type-angular',
  'nest-cli.json': 'vscode-icons-file-type-nestjs',

  // Linting/Formatting
  '.eslintrc': 'vscode-icons-file-type-eslint',
  '.eslintrc.js': 'vscode-icons-file-type-eslint',
  '.eslintrc.cjs': 'vscode-icons-file-type-eslint',
  '.eslintrc.json': 'vscode-icons-file-type-eslint',
  '.eslintrc.yml': 'vscode-icons-file-type-eslint',
  'eslint.config.js': 'vscode-icons-file-type-eslint',
  'eslint.config.mjs': 'vscode-icons-file-type-eslint',
  'eslint.config.ts': 'vscode-icons-file-type-eslint',
  '.prettierrc': 'vscode-icons-file-type-prettier',
  '.prettierrc.js': 'vscode-icons-file-type-prettier',
  '.prettierrc.json': 'vscode-icons-file-type-prettier',
  'prettier.config.js': 'vscode-icons-file-type-prettier',
  'prettier.config.mjs': 'vscode-icons-file-type-prettier',
  '.prettierignore': 'vscode-icons-file-type-prettier',
  'biome.json': 'vscode-icons-file-type-biome',
  '.stylelintrc': 'vscode-icons-file-type-stylelint',
  '.stylelintrc.json': 'vscode-icons-file-type-stylelint',

  // Testing
  'jest.config.js': 'vscode-icons-file-type-jest',
  'jest.config.ts': 'vscode-icons-file-type-jest',
  'vitest.config.ts': 'vscode-icons-file-type-vitest',
  'vitest.config.js': 'vscode-icons-file-type-vitest',
  'vitest.config.mts': 'vscode-icons-file-type-vitest',
  'playwright.config.ts': 'vscode-icons-file-type-playwright',
  'playwright.config.js': 'vscode-icons-file-type-playwright',
  'cypress.config.ts': 'vscode-icons-file-type-cypress',
  'cypress.config.js': 'vscode-icons-file-type-cypress',

  // Git
  '.gitignore': 'vscode-icons-file-type-git',
  '.gitattributes': 'vscode-icons-file-type-git',
  '.gitmodules': 'vscode-icons-file-type-git',
  '.gitkeep': 'vscode-icons-file-type-git',

  // CI/CD
  '.travis.yml': 'vscode-icons-file-type-travis',
  '.gitlab-ci.yml': 'vscode-icons-file-type-gitlab',
  'Jenkinsfile': 'vscode-icons-file-type-jenkins',
  'azure-pipelines.yml': 'vscode-icons-file-type-azurepipelines',
  'cloudbuild.yaml': 'vscode-icons-file-type-yaml',
  'vercel.json': 'vscode-icons-file-type-vercel',
  'netlify.toml': 'vscode-icons-file-type-netlify',

  // Docker
  'Dockerfile': 'vscode-icons-file-type-docker',
  'docker-compose.yml': 'vscode-icons-file-type-docker',
  'docker-compose.yaml': 'vscode-icons-file-type-docker',
  '.dockerignore': 'vscode-icons-file-type-docker',

  // Environment
  '.env': 'vscode-icons-file-type-dotenv',
  '.env.local': 'vscode-icons-file-type-dotenv',
  '.env.development': 'vscode-icons-file-type-dotenv',
  '.env.production': 'vscode-icons-file-type-dotenv',
  '.env.test': 'vscode-icons-file-type-dotenv',
  '.env.example': 'vscode-icons-file-type-dotenv',

  // Editor configs
  '.editorconfig': 'vscode-icons-file-type-editorconfig',
  '.vscode': 'vscode-icons-file-type-vscode',
  'settings.json': 'vscode-icons-file-type-vscode',
  'launch.json': 'vscode-icons-file-type-vscode',
  'extensions.json': 'vscode-icons-file-type-vscode',

  // Documentation
  'README': 'vscode-icons-file-type-markdown',
  'README.md': 'vscode-icons-file-type-markdown',
  'readme.md': 'vscode-icons-file-type-markdown',
  'README.markdown': 'vscode-icons-file-type-markdown',
  'readme.markdown': 'vscode-icons-file-type-markdown',
  'CHANGELOG': 'vscode-icons-file-type-markdown',
  'CHANGELOG.md': 'vscode-icons-file-type-markdown',
  'changelog.md': 'vscode-icons-file-type-markdown',
  'CONTRIBUTING.md': 'vscode-icons-file-type-markdown',
  'contributing.md': 'vscode-icons-file-type-markdown',
  'CODE_OF_CONDUCT.md': 'vscode-icons-file-type-markdown',
  'LICENSE': 'vscode-icons-file-type-license',
  'LICENSE.md': 'vscode-icons-file-type-license',
  'LICENSE.txt': 'vscode-icons-file-type-license',
  'license': 'vscode-icons-file-type-license',
  'license.md': 'vscode-icons-file-type-license',
  'license.txt': 'vscode-icons-file-type-license',

  // Node
  '.npmrc': 'vscode-icons-file-type-npm',
  '.npmignore': 'vscode-icons-file-type-npm',
  '.nvmrc': 'vscode-icons-file-type-node',
  '.node-version': 'vscode-icons-file-type-node',

  // Misc
  'Makefile': 'vscode-icons-file-type-makefile',
  '.browserslistrc': 'vscode-icons-file-type-browserslist',
  'browserslist': 'vscode-icons-file-type-browserslist',
  '.babelrc': 'vscode-icons-file-type-babel',
  'babel.config.js': 'vscode-icons-file-type-babel',
  'tailwind.config.js': 'vscode-icons-file-type-tailwind',
  'tailwind.config.ts': 'vscode-icons-file-type-tailwind',
  'postcss.config.js': 'vscode-icons-file-type-postcss',
  'postcss.config.cjs': 'vscode-icons-file-type-postcss',
  'uno.config.ts': 'vscode-icons-file-type-unocss',
  'unocss.config.ts': 'vscode-icons-file-type-unocss',
}

// Patterns for .d.ts and similar compound extensions
export const COMPOUND_EXTENSIONS: Record<string, string> = {
  '.d.ts': 'vscode-icons-file-type-typescriptdef',
  '.d.mts': 'vscode-icons-file-type-typescriptdef',
  '.d.cts': 'vscode-icons-file-type-typescriptdef',
  '.test.ts': 'vscode-icons-file-type-testts',
  '.test.js': 'vscode-icons-file-type-testjs',
  '.spec.ts': 'vscode-icons-file-type-testts',
  '.spec.js': 'vscode-icons-file-type-testjs',
  '.test.tsx': 'vscode-icons-file-type-testts',
  '.test.jsx': 'vscode-icons-file-type-testjs',
  '.spec.tsx': 'vscode-icons-file-type-testts',
  '.spec.jsx': 'vscode-icons-file-type-testjs',
  '.stories.tsx': 'vscode-icons-file-type-storybook',
  '.stories.ts': 'vscode-icons-file-type-storybook',
  '.stories.jsx': 'vscode-icons-file-type-storybook',
  '.stories.js': 'vscode-icons-file-type-storybook',
  '.min.js': 'vscode-icons-file-type-js-official',
  '.min.css': 'vscode-icons-file-type-css',
}

// Default icon for unknown files
export const DEFAULT_ICON = 'vscode-icons-default-file'

export const ADDITIONAL_ICONS = {
  'folder': 'lucide-folder',
  'folder-open': 'lucide-folder-open',
}

/**
 * Get the icon class for a file based on its name
 */
export function getFileIcon(filename: string): string {
  // Check exact filename match first
  if (FILENAME_ICONS[filename]) {
    return FILENAME_ICONS[filename]
  }

  // Check for compound extensions (e.g., .d.ts, .test.ts)
  for (const [suffix, icon] of Object.entries(COMPOUND_EXTENSIONS)) {
    if (filename.endsWith(suffix)) {
      return icon
    }
  }

  // Check simple extension
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (EXTENSION_ICONS[ext]) {
    return EXTENSION_ICONS[ext]
  }

  return DEFAULT_ICON
}
