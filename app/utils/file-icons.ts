/**
 * Get icon class for a file based on its name/extension.
 * Uses vscode-icons and carbon icons.
 */

// Extension to icon mapping
// @unocss-include
const EXTENSION_ICONS: Record<string, string> = {
  // JavaScript/TypeScript
  'js': 'i-vscode-icons-file-type-js-official',
  'mjs': 'i-vscode-icons-file-type-js-official',
  'cjs': 'i-vscode-icons-file-type-js-official',
  'ts': 'i-vscode-icons-file-type-typescript-official',
  'mts': 'i-vscode-icons-file-type-typescript-official',
  'cts': 'i-vscode-icons-file-type-typescript-official',
  'jsx': 'i-vscode-icons-file-type-reactjs',
  'tsx': 'i-vscode-icons-file-type-reactts',

  // Web
  'html': 'i-vscode-icons-file-type-html',
  'htm': 'i-vscode-icons-file-type-html',
  'css': 'i-vscode-icons-file-type-css',
  'scss': 'i-vscode-icons-file-type-scss',
  'sass': 'i-vscode-icons-file-type-sass',
  'less': 'i-vscode-icons-file-type-less',
  'styl': 'i-vscode-icons-file-type-stylus',
  'vue': 'i-vscode-icons-file-type-vue',
  'svelte': 'i-vscode-icons-file-type-svelte',
  'astro': 'i-vscode-icons-file-type-astro',
  'gjs': 'i-vscode-icons-file-type-glimmer',
  'gts': 'i-vscode-icons-file-type-glimmer',

  // Config/Data
  'json': 'i-vscode-icons-file-type-json',
  'jsonc': 'i-vscode-icons-file-type-json',
  'json5': 'i-vscode-icons-file-type-json5',
  'yaml': 'i-vscode-icons-file-type-yaml',
  'yml': 'i-vscode-icons-file-type-yaml',
  'toml': 'i-vscode-icons-file-type-toml',
  'xml': 'i-vscode-icons-file-type-xml',
  'svg': 'i-vscode-icons-file-type-svg',
  'graphql': 'i-vscode-icons-file-type-graphql',
  'gql': 'i-vscode-icons-file-type-graphql',
  'prisma': 'i-vscode-icons-file-type-prisma',

  // Documentation
  'md': 'i-vscode-icons-file-type-markdown',
  'mdx': 'i-vscode-icons-file-type-mdx',
  'txt': 'i-vscode-icons-file-type-text',
  'rst': 'i-vscode-icons-file-type-text',
  'pdf': 'i-vscode-icons-file-type-pdf2',

  // Shell/Scripts
  'sh': 'i-vscode-icons-file-type-shell',
  'bash': 'i-vscode-icons-file-type-shell',
  'zsh': 'i-vscode-icons-file-type-shell',
  'fish': 'i-vscode-icons-file-type-shell',
  'ps1': 'i-vscode-icons-file-type-powershell',
  'bat': 'i-vscode-icons-file-type-bat',
  'cmd': 'i-vscode-icons-file-type-bat',

  // Programming languages
  'py': 'i-vscode-icons-file-type-python',
  'pyi': 'i-vscode-icons-file-type-python',
  'rb': 'i-vscode-icons-file-type-ruby',
  'go': 'i-vscode-icons-file-type-go',
  'rs': 'i-vscode-icons-file-type-rust',
  'java': 'i-vscode-icons-file-type-java',
  'kt': 'i-vscode-icons-file-type-kotlin',
  'swift': 'i-vscode-icons-file-type-swift',
  'c': 'i-vscode-icons-file-type-c',
  'cpp': 'i-vscode-icons-file-type-cpp',
  'h': 'i-vscode-icons-file-type-cheader',
  'hpp': 'i-vscode-icons-file-type-cppheader',
  'cs': 'i-vscode-icons-file-type-csharp',
  'php': 'i-vscode-icons-file-type-php',
  'lua': 'i-vscode-icons-file-type-lua',
  'r': 'i-vscode-icons-file-type-r',
  'sql': 'i-vscode-icons-file-type-sql',
  'pl': 'i-vscode-icons-file-type-perl',
  'ex': 'i-vscode-icons-file-type-elixir',
  'exs': 'i-vscode-icons-file-type-elixir',
  'erl': 'i-vscode-icons-file-type-erlang',
  'hs': 'i-vscode-icons-file-type-haskell',
  'clj': 'i-vscode-icons-file-type-clojure',
  'scala': 'i-vscode-icons-file-type-scala',
  'zig': 'i-vscode-icons-file-type-zig',
  'nim': 'i-vscode-icons-file-type-nim',
  'v': 'i-vscode-icons-file-type-vlang',
  'wasm': 'i-vscode-icons-file-type-wasm',

  // Images
  'png': 'i-vscode-icons-file-type-image',
  'jpg': 'i-vscode-icons-file-type-image',
  'jpeg': 'i-vscode-icons-file-type-image',
  'gif': 'i-vscode-icons-file-type-image',
  'webp': 'i-vscode-icons-file-type-image',
  'ico': 'i-vscode-icons-file-type-image',
  'bmp': 'i-vscode-icons-file-type-image',

  // Fonts
  'woff': 'i-vscode-icons-file-type-font',
  'woff2': 'i-vscode-icons-file-type-font',
  'ttf': 'i-vscode-icons-file-type-font',
  'otf': 'i-vscode-icons-file-type-font',
  'eot': 'i-vscode-icons-file-type-font',

  // Archives
  'zip': 'i-vscode-icons-file-type-zip',
  'tar': 'i-vscode-icons-file-type-zip',
  'gz': 'i-vscode-icons-file-type-zip',
  'tgz': 'i-vscode-icons-file-type-zip',
  'bz2': 'i-vscode-icons-file-type-zip',
  '7z': 'i-vscode-icons-file-type-zip',
  'rar': 'i-vscode-icons-file-type-zip',

  // Certificates/Keys
  'pem': 'i-vscode-icons-file-type-cert',
  'crt': 'i-vscode-icons-file-type-cert',
  'key': 'i-vscode-icons-file-type-key',

  // Diff/Patch
  'diff': 'i-vscode-icons-file-type-diff',
  'patch': 'i-vscode-icons-file-type-diff',

  // Other
  'log': 'i-vscode-icons-file-type-log',
  'lock': 'i-vscode-icons-file-type-json',
  'map': 'i-vscode-icons-file-type-map',
  'wrl': 'i-vscode-icons-file-type-binary',
  'bin': 'i-vscode-icons-file-type-binary',
  'node': 'i-vscode-icons-file-type-node',
}

// Special filenames that have specific icons
const FILENAME_ICONS: Record<string, string> = {
  // Package managers
  'package.json': 'i-vscode-icons-file-type-npm',
  'package-lock.json': 'i-vscode-icons-file-type-npm',
  'pnpm-lock.yaml': 'i-vscode-icons-file-type-pnpm',
  'pnpm-workspace.yaml': 'i-vscode-icons-file-type-pnpm',
  'yarn.lock': 'i-vscode-icons-file-type-yarn',
  '.yarnrc': 'i-vscode-icons-file-type-yarn',
  '.yarnrc.yml': 'i-vscode-icons-file-type-yarn',
  'bun.lockb': 'i-vscode-icons-file-type-bun',
  'bunfig.toml': 'i-vscode-icons-file-type-bun',
  'deno.json': 'i-vscode-icons-file-type-deno',
  'deno.jsonc': 'i-vscode-icons-file-type-deno',

  // TypeScript configs
  'tsconfig.json': 'i-vscode-icons-file-type-tsconfig',
  'tsconfig.base.json': 'i-vscode-icons-file-type-tsconfig',
  'tsconfig.build.json': 'i-vscode-icons-file-type-tsconfig',
  'tsconfig.node.json': 'i-vscode-icons-file-type-tsconfig',
  'jsconfig.json': 'i-vscode-icons-file-type-jsconfig',

  // Build tools
  'vite.config.ts': 'i-vscode-icons-file-type-vite',
  'vite.config.js': 'i-vscode-icons-file-type-vite',
  'vite.config.mts': 'i-vscode-icons-file-type-vite',
  'vite.config.mjs': 'i-vscode-icons-file-type-vite',
  'webpack.config.js': 'i-vscode-icons-file-type-webpack',
  'webpack.config.ts': 'i-vscode-icons-file-type-webpack',
  'rollup.config.js': 'i-vscode-icons-file-type-rollup',
  'rollup.config.ts': 'i-vscode-icons-file-type-rollup',
  'rollup.config.mjs': 'i-vscode-icons-file-type-rollup',
  'esbuild.config.js': 'i-vscode-icons-file-type-esbuild',
  'turbo.json': 'i-vscode-icons-file-type-turbo',
  'nx.json': 'i-vscode-icons-file-type-nx',

  // Framework configs
  'nuxt.config.ts': 'i-vscode-icons-file-type-nuxt',
  'nuxt.config.js': 'i-vscode-icons-file-type-nuxt',
  'next.config.js': 'i-vscode-icons-file-type-next',
  'next.config.mjs': 'i-vscode-icons-file-type-next',
  'next.config.ts': 'i-vscode-icons-file-type-next',
  'svelte.config.js': 'i-vscode-icons-file-type-svelte',
  'astro.config.mjs': 'i-vscode-icons-file-type-astro',
  'astro.config.ts': 'i-vscode-icons-file-type-astro',
  'remix.config.js': 'i-vscode-icons-file-type-js-official',
  'angular.json': 'i-vscode-icons-file-type-angular',
  'nest-cli.json': 'i-vscode-icons-file-type-nestjs',

  // Linting/Formatting
  '.eslintrc': 'i-vscode-icons-file-type-eslint',
  '.eslintrc.js': 'i-vscode-icons-file-type-eslint',
  '.eslintrc.cjs': 'i-vscode-icons-file-type-eslint',
  '.eslintrc.json': 'i-vscode-icons-file-type-eslint',
  '.eslintrc.yml': 'i-vscode-icons-file-type-eslint',
  'eslint.config.js': 'i-vscode-icons-file-type-eslint',
  'eslint.config.mjs': 'i-vscode-icons-file-type-eslint',
  'eslint.config.ts': 'i-vscode-icons-file-type-eslint',
  '.prettierrc': 'i-vscode-icons-file-type-prettier',
  '.prettierrc.js': 'i-vscode-icons-file-type-prettier',
  '.prettierrc.json': 'i-vscode-icons-file-type-prettier',
  'prettier.config.js': 'i-vscode-icons-file-type-prettier',
  'prettier.config.mjs': 'i-vscode-icons-file-type-prettier',
  '.prettierignore': 'i-vscode-icons-file-type-prettier',
  'biome.json': 'i-vscode-icons-file-type-biome',
  '.stylelintrc': 'i-vscode-icons-file-type-stylelint',
  '.stylelintrc.json': 'i-vscode-icons-file-type-stylelint',

  // Testing
  'jest.config.js': 'i-vscode-icons-file-type-jest',
  'jest.config.ts': 'i-vscode-icons-file-type-jest',
  'vitest.config.ts': 'i-vscode-icons-file-type-vitest',
  'vitest.config.js': 'i-vscode-icons-file-type-vitest',
  'vitest.config.mts': 'i-vscode-icons-file-type-vitest',
  'playwright.config.ts': 'i-vscode-icons-file-type-playwright',
  'playwright.config.js': 'i-vscode-icons-file-type-playwright',
  'cypress.config.ts': 'i-vscode-icons-file-type-cypress',
  'cypress.config.js': 'i-vscode-icons-file-type-cypress',

  // Git
  '.gitignore': 'i-vscode-icons-file-type-git',
  '.gitattributes': 'i-vscode-icons-file-type-git',
  '.gitmodules': 'i-vscode-icons-file-type-git',
  '.gitkeep': 'i-vscode-icons-file-type-git',

  // CI/CD
  '.travis.yml': 'i-vscode-icons-file-type-travis',
  '.gitlab-ci.yml': 'i-vscode-icons-file-type-gitlab',
  'Jenkinsfile': 'i-vscode-icons-file-type-jenkins',
  'azure-pipelines.yml': 'i-vscode-icons-file-type-azurepipelines',
  'cloudbuild.yaml': 'i-vscode-icons-file-type-yaml',
  'vercel.json': 'i-vscode-icons-file-type-vercel',
  'netlify.toml': 'i-vscode-icons-file-type-netlify',

  // Docker
  'Dockerfile': 'i-vscode-icons-file-type-docker',
  'docker-compose.yml': 'i-vscode-icons-file-type-docker',
  'docker-compose.yaml': 'i-vscode-icons-file-type-docker',
  '.dockerignore': 'i-vscode-icons-file-type-docker',

  // Environment
  '.env': 'i-vscode-icons-file-type-dotenv',
  '.env.local': 'i-vscode-icons-file-type-dotenv',
  '.env.development': 'i-vscode-icons-file-type-dotenv',
  '.env.production': 'i-vscode-icons-file-type-dotenv',
  '.env.test': 'i-vscode-icons-file-type-dotenv',
  '.env.example': 'i-vscode-icons-file-type-dotenv',

  // Editor configs
  '.editorconfig': 'i-vscode-icons-file-type-editorconfig',
  '.vscode': 'i-vscode-icons-file-type-vscode',
  'settings.json': 'i-vscode-icons-file-type-vscode',
  'launch.json': 'i-vscode-icons-file-type-vscode',
  'extensions.json': 'i-vscode-icons-file-type-vscode',

  // Documentation
  'README': 'i-vscode-icons-file-type-markdown',
  'README.md': 'i-vscode-icons-file-type-markdown',
  'readme.md': 'i-vscode-icons-file-type-markdown',
  'README.markdown': 'i-vscode-icons-file-type-markdown',
  'readme.markdown': 'i-vscode-icons-file-type-markdown',
  'CHANGELOG': 'i-vscode-icons-file-type-markdown',
  'CHANGELOG.md': 'i-vscode-icons-file-type-markdown',
  'changelog.md': 'i-vscode-icons-file-type-markdown',
  'CONTRIBUTING.md': 'i-vscode-icons-file-type-markdown',
  'contributing.md': 'i-vscode-icons-file-type-markdown',
  'CODE_OF_CONDUCT.md': 'i-vscode-icons-file-type-markdown',
  'LICENSE': 'i-vscode-icons-file-type-license',
  'LICENSE.md': 'i-vscode-icons-file-type-license',
  'LICENSE.txt': 'i-vscode-icons-file-type-license',
  'license': 'i-vscode-icons-file-type-license',
  'license.md': 'i-vscode-icons-file-type-license',
  'license.txt': 'i-vscode-icons-file-type-license',

  // Node
  '.npmrc': 'i-vscode-icons-file-type-npm',
  '.npmignore': 'i-vscode-icons-file-type-npm',
  '.nvmrc': 'i-vscode-icons-file-type-node',
  '.node-version': 'i-vscode-icons-file-type-node',

  // Misc
  'Makefile': 'i-vscode-icons-file-type-makefile',
  '.browserslistrc': 'i-vscode-icons-file-type-browserslist',
  'browserslist': 'i-vscode-icons-file-type-browserslist',
  '.babelrc': 'i-vscode-icons-file-type-babel',
  'babel.config.js': 'i-vscode-icons-file-type-babel',
  'tailwind.config.js': 'i-vscode-icons-file-type-tailwind',
  'tailwind.config.ts': 'i-vscode-icons-file-type-tailwind',
  'postcss.config.js': 'i-vscode-icons-file-type-postcss',
  'postcss.config.cjs': 'i-vscode-icons-file-type-postcss',
  'uno.config.ts': 'i-vscode-icons-file-type-unocss',
  'unocss.config.ts': 'i-vscode-icons-file-type-unocss',
}

// Patterns for .d.ts and similar compound extensions
const COMPOUND_EXTENSIONS: Record<string, string> = {
  '.d.ts': 'i-vscode-icons-file-type-typescriptdef',
  '.d.mts': 'i-vscode-icons-file-type-typescriptdef',
  '.d.cts': 'i-vscode-icons-file-type-typescriptdef',
  '.test.ts': 'i-vscode-icons-file-type-testts',
  '.test.js': 'i-vscode-icons-file-type-testjs',
  '.spec.ts': 'i-vscode-icons-file-type-testts',
  '.spec.js': 'i-vscode-icons-file-type-testjs',
  '.test.tsx': 'i-vscode-icons-file-type-testts',
  '.test.jsx': 'i-vscode-icons-file-type-testjs',
  '.spec.tsx': 'i-vscode-icons-file-type-testts',
  '.spec.jsx': 'i-vscode-icons-file-type-testjs',
  '.stories.tsx': 'i-vscode-icons-file-type-storybook',
  '.stories.ts': 'i-vscode-icons-file-type-storybook',
  '.stories.jsx': 'i-vscode-icons-file-type-storybook',
  '.stories.js': 'i-vscode-icons-file-type-storybook',
  '.min.js': 'i-vscode-icons-file-type-js-official',
  '.min.css': 'i-vscode-icons-file-type-css',
}

// Default icon for unknown files
const DEFAULT_ICON = 'i-vscode-icons-default-file'

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
