import Worker from '~/utils/pkg-size/analyze-cause-worker?worker'

export const worker = new Worker({
  name: 'NpmxPkgSizeAnalyzeCauseWorker',
})
