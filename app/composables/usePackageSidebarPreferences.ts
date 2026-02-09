interface SidebarPreferences {
  collapsed: string[]
}

const STORAGE_KEY = 'npmx-sidebar-preferences'
const DEFAULT_SIDEBAR_PREFERENCES: SidebarPreferences = { collapsed: [] }

let sidebarRef: Ref<SidebarPreferences> | null = null

/**
 * Composable for managing sidebar section collapsed state.
 * This is local-only and uses its own LS key.
 */
export function usePackageSidebarPreferences() {
  if (!sidebarRef) {
    sidebarRef = useLocalStorage<SidebarPreferences>(STORAGE_KEY, DEFAULT_SIDEBAR_PREFERENCES, {
      mergeDefaults: true,
    })
  }

  return {
    sidebarPreferences: sidebarRef,
  }
}
