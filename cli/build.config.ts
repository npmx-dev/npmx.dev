import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    { input: 'src/index', name: 'index' },
    { input: 'src/cli', name: 'cli' },
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: false,
  },
})
