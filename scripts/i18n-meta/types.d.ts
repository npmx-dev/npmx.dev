export type EnJson = {
  [key: string]: string | EnJson
}

export type MetaEntry = {
  text: string
  commit: string
}

export type EnMetaJson = {
  $meta?: {
    last_updated_commit: string
    updated_at: string
  }
  [key: string]: string | MetaEntry | EnMetaJson
}
