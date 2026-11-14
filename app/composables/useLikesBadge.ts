const STORAGE_KEY = 'npmx-likes-badge'
const POLL_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

interface StoredLikes {
  npmUser: string
  counts: Record<string, number>
}

function loadStored(npmUser: string): StoredLikes | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as StoredLikes
    return data.npmUser === npmUser ? data : null
  } catch {
    return null
  }
}

function saveStored(npmUser: string, counts: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ npmUser, counts } satisfies StoredLikes))
}

export function useLikesBadge() {
  const { isConnected, npmUser, listUserPackages } = useConnector()
  const { setBadge, clearBadge, canBadge } = useAppBadge()
  const { settings } = useSettings()
  const enabled = computed(() => settings.value.connector.showLikesBadge)

  // Cached package list — refreshed only when the npm user changes.
  const userPackages = shallowRef<string[]>([])

  watch(npmUser, async user => {
    if (!user) {
      userPackages.value = []
      return
    }
    const pkgMap = await listUserPackages()
    // Cap at 20 packages to keep the polling cost bounded.
    userPackages.value = pkgMap ? Object.keys(pkgMap).sort().slice(0, 20) : []
  })

  async function checkLikes() {
    if (!canBadge || !enabled.value || !npmUser.value || !userPackages.value.length) return

    const results = await Promise.allSettled(
      userPackages.value.map(pkg =>
        $fetch<{ totalLikes: number }>(`/api/social/likes/${encodeURIComponent(pkg)}`),
      ),
    )

    const current: Record<string, number> = {}
    for (let i = 0; i < userPackages.value.length; i++) {
      const r = results[i]
      if (r?.status === 'fulfilled') {
        current[userPackages.value[i]!] = r.value.totalLikes
      }
    }

    const stored = loadStored(npmUser.value)

    let newLikes = 0
    for (const [pkg, count] of Object.entries(current)) {
      // On first check there is no baseline — store current and show nothing.
      const prev = stored?.counts[pkg] ?? count
      newLikes += Math.max(0, count - prev)
    }

    saveStored(npmUser.value, current)

    if (newLikes > 0) {
      setBadge(newLikes)
    } else {
      clearBadge()
    }
  }

  let timer: ReturnType<typeof setInterval> | null = null

  watch(
    [isConnected, npmUser, enabled],
    ([connected, user, isEnabled]) => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      if (connected && user && isEnabled) {
        checkLikes()
        timer = setInterval(checkLikes, POLL_INTERVAL_MS)
      } else {
        clearBadge()
      }
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    if (timer) clearInterval(timer)
  })
}
