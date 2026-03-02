export interface UserLocalSettings {
  sidebar: {
    collapsed: string[]
    animateSparkline: boolean
  }
  connector: {
    autoOpenURL: boolean
  }
  chartFilter: {
    averageWindow: number
    smoothingTau: number
    anomaliesFixed: boolean
  }
}

const STORAGE_KEY = 'npmx-settings'
const DEFAULT_USER_LOCAL_SETTINGS: UserLocalSettings = {
  sidebar: {
    collapsed: [],
    animateSparkline: true,
  },
  connector: {
    autoOpenURL: false,
  },
  chartFilter: {
    averageWindow: 0,
    smoothingTau: 1,
    anomaliesFixed: true,
  },
}

let localSettingsRef: Ref<UserLocalSettings> | null = null

/**
 * Composable for managing local user settings.
 * Uses its own LS key.
 *
 * This is for settings that are purely local and don't need to be synced
 */
export function useUserLocalSettings() {
  if (!localSettingsRef) {
    localSettingsRef = useLocalStorage<UserLocalSettings>(
      STORAGE_KEY,
      DEFAULT_USER_LOCAL_SETTINGS,
      {
        mergeDefaults: true,
      },
    )
  }

  return {
    localSettings: localSettingsRef,
  }
}
