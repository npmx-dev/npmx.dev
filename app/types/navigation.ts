export type NavigationLink = {
  name: string
  label: string
  iconClass?: string
  to?: {
    name?: string
  }
  href?: string
  target?: string
  keyshortcut?: string
  type: 'link'
  external?: boolean
}

export type NavigationSeparator = {
  type: 'separator'
}

export type NavigationConfig = NavigationLink[]

export type NavigationGroup = {
  name: string
  type: 'group'
  label?: string
  items: NavigationConfig
}

export type NavigationConfigWithGroups = Array<NavigationGroup | NavigationSeparator>
