import type { RouteLocationRaw } from 'vue-router'

export type CommandPaletteGroup =
  | 'actions'
  | 'help'
  | 'language'
  | 'package'
  | 'navigation'
  | 'connections'
  | 'links'
  | 'settings'
  | 'npmx'
  | 'versions'

export type CommandPaletteView = 'root' | 'languages' | 'accent-colors' | 'background-themes'

interface CommandPaletteCommandBase {
  id: string
  group: CommandPaletteGroup
  label: string
  keywords: string[]
  iconClass: string
  badge?: string | null
  previewColor?: string | null
  active?: boolean
  activeLabel?: string | null
}

export type CommandPaletteActionCommand = CommandPaletteCommandBase & {
  action: () => void | Promise<void>
  to?: never
  href?: never
}

export type CommandPaletteRouteCommand = CommandPaletteCommandBase & {
  to: RouteLocationRaw | string
  action?: never
  href?: never
}

export type CommandPaletteHrefCommand = CommandPaletteCommandBase & {
  href: string
  action?: never
  to?: never
}

export type CommandPaletteLinkCommand = CommandPaletteRouteCommand | CommandPaletteHrefCommand

export type CommandPaletteCommand =
  | CommandPaletteActionCommand
  | CommandPaletteRouteCommand
  | CommandPaletteHrefCommand

export interface CommandPaletteCommandGroup {
  id: CommandPaletteGroup
  label: string
  items: CommandPaletteCommand[]
}

export type CommandPaletteContextCommand =
  | (CommandPaletteCommandBase & {
      actionId: string
      to?: never
      href?: never
    })
  | (CommandPaletteCommandBase & {
      actionId: string
      to: RouteLocationRaw | string
      href?: never
    })
  | (CommandPaletteCommandBase & {
      actionId: string
      href: string
      to?: never
    })

export type CommandPaletteContextCommandInput = CommandPaletteCommand

export interface CommandPalettePackageContext {
  packageName: string
  resolvedVersion: string | null
  latestVersion: string | null
  versions: string[]
  tarballUrl?: string | null
}
