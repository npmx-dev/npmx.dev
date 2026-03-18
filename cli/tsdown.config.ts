import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: 'esm',
  clean: true,
  dts: true,
  outDir: 'dist',
  external: ['@lydell/node-pty'],
})
