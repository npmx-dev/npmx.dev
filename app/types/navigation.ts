import type { NuxtLinkProps } from '#app'

type NavigationLink = {
  name: string
  label: string
  iconClass?: string
  to?: NuxtLinkProps['to'] & { name?: string }
  href?: string
  target?: string
  keyshortcut?: string
  type: 'link'
  external?: boolean
}

type NavigationSeparator = {
  type: 'separator'
}

export type NavigationConfig = NavigationLink[]

type NavigationGroup = {
  name: string
  type: 'group'
  label?: string
  items: NavigationConfig
}

export type NavigationConfigWithGroups = Array<NavigationGroup | NavigationSeparator>
