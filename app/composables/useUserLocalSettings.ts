interface UserLocalSettings {
  sidebar: {
    collapsed: string[]
  }
  connector: {
    autoOpenURL: boolean
  }
}

const STORAGE_KEY = 'npmx-settings'
const DEFAULT_USER_LOCAL_SETTINGS: UserLocalSettings = {
  sidebar: {
    collapsed: [],
  },
  connector: {
    autoOpenURL: false,
  },
}

let userLocalSettingsRef: Ref<UserLocalSettings> | null = null

/**
 * Composable for managing local user settings.
 * Uses its own LS key.
 *
 * This is for settings that are purely local and don't need to be synced
 */
export function useUserLocalSettings() {
  if (!userLocalSettingsRef) {
    userLocalSettingsRef = useLocalStorage<UserLocalSettings>(
      STORAGE_KEY,
      DEFAULT_USER_LOCAL_SETTINGS,
      {
        mergeDefaults: true,
      },
    )
  }

  return {
    userLocalSettings: userLocalSettingsRef,
  }
}
