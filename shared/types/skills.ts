export interface SkillFrontmatter {
  name: string
  description: string
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
}

export interface SkillWarning {
  type: 'error' | 'warning'
  message: string
}

export interface SkillFileCounts {
  scripts?: number
  references?: number
  assets?: number
}

export interface SkillListItem {
  name: string
  description: string
  dirName: string
  license?: string
  compatibility?: string
  warnings?: SkillWarning[]
  fileCounts?: SkillFileCounts
}

export interface SkillsListResponse {
  package: string
  version: string
  skills: SkillListItem[]
}

export interface SkillContentResponse {
  package: string
  version: string
  skill: string
  frontmatter: SkillFrontmatter
  content: string
}
