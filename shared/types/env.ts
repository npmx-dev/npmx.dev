export type EnvType = 'dev' | 'preview' | 'canary' | 'release'

export interface BuildInfo {
  version: string
  commit: string
  shortCommit: string
  time: number
  branch: string
  env: EnvType
}
