import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { PackageFileContentResponse } from '#shared/types/npm-registry'
import Header from './Header.vue'

const getCodeUrlWithPath = (path?: string) => (path ? `/${path}` : '/')

const fileContent: PackageFileContentResponse = {
  package: 'mock-package',
  version: '1.0.0',
  path: 'src/utils/format.ts',
  language: 'typescript',
  contentType: 'text/plain',
  content: 'export const format = (value: number) => value.toLocaleString()\n',
  html: '',
  lines: 1,
}

const readmeContent: PackageFileContentResponse = {
  ...fileContent,
  path: 'README.md',
  language: 'markdown',
  content: '# mock-package\n\nA mock package.\n',
  markdownHtml: {
    html: '<h1>mock-package</h1><p>A mock package.</p>',
    playgroundLinks: [],
    toc: [],
  },
}

const meta = {
  component: Header,
  tags: ['autodocs'],
  args: {
    loading: false,
    isViewingFile: true,
    isBinaryFile: false,
    fileContent,
    filePath: 'src/utils/format.ts',
    markdownViewMode: 'preview',
    selectedLines: null,
    getCodeUrlWithPath,
    packageName: 'mock-package',
    version: '1.0.0',
  },
} satisfies Meta<typeof Header>

export default meta
type Story = StoryObj<typeof meta>

/** Viewing a source file: breadcrumbs plus copy and raw-file actions. */
export const FileView: Story = {}

/** Browsing a directory rather than a file — only the layout controls show. */
export const DirectoryView: Story = {
  args: {
    isViewingFile: false,
    filePath: null,
    fileContent: null,
  },
}

/** A markdown file adds the preview / code view-mode toggle. */
export const MarkdownFile: Story = {
  args: {
    filePath: 'README.md',
    fileContent: readmeContent,
  },
}

/** With lines selected, the copy-permalink button appears. */
export const WithSelectedLines: Story = {
  args: {
    selectedLines: { start: 1, end: 1 },
  },
}

/** A binary file hides the text-specific actions. */
export const BinaryFile: Story = {
  args: {
    isBinaryFile: true,
    filePath: 'assets/logo.png',
    fileContent: { ...fileContent, path: 'assets/logo.png', content: '' },
  },
}

/** While loading, the layout toggle is disabled. */
export const Loading: Story = {
  args: {
    loading: true,
    isViewingFile: false,
    filePath: null,
    fileContent: null,
  },
}
