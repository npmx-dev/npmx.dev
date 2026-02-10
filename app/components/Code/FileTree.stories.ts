import type { Meta, StoryObj } from '@nuxtjs/storybook'
import FileTree from './FileTree.vue'

export default {
  component: FileTree,
} satisfies Meta<typeof FileTree>

export const Default: StoryObj<typeof FileTree> = {
  args: {
    tree: [
      {
        name: 'assets',
        path: 'assets',
        type: 'directory',
        children: [
          {
            name: 'favicon.svg',
            path: 'assets/browser/favicon.svg',
            type: 'file',
            size: 2163,
          },
        ],
      },
      {
        name: 'dist',
        path: 'dist',
        type: 'directory',
        children: [
          {
            name: 'bin',
            path: 'dist/bin',
            type: 'directory',
            children: [
              {
                name: 'core.js',
                path: 'dist/bin/core.js',
                type: 'file',
                size: 126956,
              },
              {
                name: 'dispatcher.js',
                path: 'dist/bin/dispatcher.js',
                type: 'file',
                size: 2788,
              },
              {
                name: 'loader.js',
                path: 'dist/bin/loader.js',
                type: 'file',
                size: 3600,
              },
            ],
          },
          {
            name: 'types',
            path: 'dist/types',
            type: 'directory',
            children: [
              {
                name: 'index.d.ts',
                path: 'dist/types/index.d.ts',
                type: 'file',
                size: 127300,
              },
              {
                name: 'index.js',
                path: 'dist/types/index.js',
                type: 'file',
                size: 3381,
              },
            ],
          },
        ],
      },
      {
        name: 'package.json',
        path: 'package.json',
        type: 'file',
        size: 11104,
      },
      {
        name: 'README.md',
        path: 'README.md',
        type: 'file',
        size: 1606,
      },
    ],
    currentPath: '',
    baseUrl: '/package-code/foo/v/10.2.8',
    basePath: ['foo', 'v', '10.2.8'],
  },
}
