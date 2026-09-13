import type { NuxtLinkProps } from '#app'
import type { IconClass } from './icon'

type MenuDropdownItemBase = {
  title: string
  description?: string
  icon?: IconClass
  /** Keyboard shortcut hint, e.g. "c" or "⌘K" */
  shortcut?: string
}

export type MenuDropdownLinkItem = MenuDropdownItemBase & {
  type: 'link'
  href: NuxtLinkProps['to']
  external?: boolean
}

export type MenuDropdownActionItem = MenuDropdownItemBase & {
  type: 'action'
  handler: () => void
}

export type MenuDropdownItem = MenuDropdownLinkItem | MenuDropdownActionItem
