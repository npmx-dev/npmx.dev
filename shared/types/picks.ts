export interface NpmxPick {
  letter: 'n' | 'p' | 'm' | 'x'
  name: string
  letterIndex: number
}

export interface NpmxPicksResponse {
  picks: NpmxPick[]
}
