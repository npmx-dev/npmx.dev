<script setup lang="ts">
const route = useRoute('~username-orgs')

const username = computed(() => route.params.username)

const { isConnected, npmUser, listUserOrgs, listOrgUsers } = useConnector()

// Only allow viewing your own orgs page
const isOwnProfile = computed(() => {
  return isConnected.value && npmUser.value?.toLowerCase() === username.value.toLowerCase()
})

interface OrgInfo {
  name: string
  role: 'developer' | 'admin' | 'owner' | null
  packageCount: number | null
  isLoadingDetails: boolean
}

const isLoading = shallowRef(true)
const orgs = shallowRef<OrgInfo[]>([])
const error = shallowRef<string | null>(null)

async function loadOrgDetails(org: OrgInfo) {
  org.isLoadingDetails = true

  // Fetch package count using our server API (proxies to npm registry)
  try {
    const response = await $fetch<{ count: number }>(
      `/api/registry/org/${encodeURIComponent(org.name)}/packages`,
      { timeout: 5000 },
    )
    org.packageCount = response.count
  } catch {
    org.packageCount = null
  }

  // Fetch user's role in this org
  try {
    const users = await listOrgUsers(org.name)
    if (users && npmUser.value) {
      const lowerUser = npmUser.value.toLowerCase()
      const entry = Object.entries(users).find(([k]) => k.toLowerCase() === lowerUser)
      org.role = entry?.[1] ?? null
    }
  } catch {
    org.role = null
  }

  org.isLoadingDetails = false
}

async function loadOrgs() {
  if (!isOwnProfile.value) {
    isLoading.value = false
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const orgList = await listUserOrgs()
    if (orgList) {
      orgs.value = orgList.map(name => ({
        name,
        role: null,
        packageCount: null,
        isLoadingDetails: true,
      }))

      // Load details for each org in parallel
      await Promise.all(orgs.value.map(org => loadOrgDetails(org)))
    } else {
      error.value = $t('header.orgs_dropdown.error')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : $t('header.orgs_dropdown.error')
  } finally {
    isLoading.value = false
  }
}

// Load on mount and when connection status changes
watch(isOwnProfile, loadOrgs, { immediate: true })

function getRoleBadgeClass(role: string | null): string {
  switch (role) {
    case 'owner':
      return 'bg-purple-500/20 text-purple-300'
    case 'admin':
      return 'bg-blue-500/20 text-blue-300'
    case 'developer':
      return 'bg-green-500/20 text-green-300'
    default:
      return 'bg-fg-subtle/20 text-fg-muted'
  }
}

useSeoMeta({
  title: () => `@${username.value} Organizations - npmx`,
  description: () => `npm organizations for ${username.value}`,
})

defineOgImageComponent('Default', {
  title: () => `@${username.value}`,
  description: () => {
    if (isLoading.value) return 'npm organizations'
    if (orgs.value.length === 0) return 'No organizations found'

    const count = orgs.value.length
    return `${count} ${count === 1 ? 'organization' : 'organizations'}`
  },
  primaryColor: '#60a5fa',
})
</script>

<template>
  <main class="container flex-1 py-8 sm:py-12 w-full">
    <!-- Header -->
    <header class="mb-8 pb-8 border-b border-border">
      <div class="flex flex-wrap items-center gap-4 mb-4">
        <UserAvatar :username="username" />
        <div>
          <h1 class="font-mono text-2xl sm:text-3xl font-medium">~{{ username }}</h1>
          <p class="text-fg-muted text-sm mt-1">{{ $t('user.orgs_page.title') }}</p>
        </div>
      </div>

      <!-- Back link -->
      <nav aria-labelledby="back-to-profile">
        <NuxtLink
          :to="`/~${username}`"
          id="back-to-profile"
          class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
        >
          <span class="i-carbon:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
          {{ $t('user.orgs_page.back_to_profile') }}
        </NuxtLink>
      </nav>
    </header>

    <!-- Not connected state -->
    <ClientOnly>
      <div v-if="!isConnected" class="py-12 text-center">
        <p class="text-fg-muted mb-4">{{ $t('user.orgs_page.connect_required') }}</p>
        <p class="text-fg-subtle text-sm">
          {{ $t('user.orgs_page.connect_hint_prefix') }}
          <code class="font-mono bg-bg-subtle px-1.5 py-0.5 rounded">npx @npmx.dev/cli</code>
          {{ $t('user.orgs_page.connect_hint_suffix') }}
        </p>
      </div>

      <!-- Not own profile state -->
      <div v-else-if="!isOwnProfile" class="py-12 text-center">
        <p class="text-fg-muted">{{ $t('user.orgs_page.own_orgs_only') }}</p>
        <NuxtLink :to="`/~${npmUser}/orgs`" class="btn mt-4">{{
          $t('user.orgs_page.view_your_orgs')
        }}</NuxtLink>
      </div>

      <!-- Loading state -->
      <LoadingSpinner v-else-if="isLoading" :text="$t('user.orgs_page.loading')" />

      <!-- Error state -->
      <div v-else-if="error" role="alert" class="py-12 text-center">
        <p class="text-fg-muted mb-4">{{ error }}</p>
        <button type="button" class="btn" @click="loadOrgs">{{ $t('common.try_again') }}</button>
      </div>

      <!-- Empty state -->
      <div v-else-if="orgs.length === 0" class="py-12 text-center">
        <p class="text-fg-muted">{{ $t('user.orgs_page.empty') }}</p>
        <p class="text-fg-subtle text-sm mt-2">
          {{ $t('user.orgs_page.empty_hint') }}
        </p>
      </div>

      <!-- Orgs list -->
      <section v-else :aria-label="$t('user.orgs_page.title')">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
          {{ $t('user.orgs_page.count', { count: orgs.length }, orgs.length) }}
        </h2>

        <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="org in orgs" :key="org.name">
            <NuxtLink
              :to="`/@${org.name}`"
              class="block p-5 bg-bg-subtle border border-border rounded-lg hover:border-fg-subtle transition-colors h-full"
            >
              <div class="flex items-start gap-4 mb-4">
                <!-- Org avatar -->
                <div
                  class="w-14 h-14 rounded-lg bg-bg-muted border border-border flex items-center justify-center flex-shrink-0"
                  aria-hidden="true"
                >
                  <span class="text-2xl text-fg-subtle font-mono">{{
                    org.name.charAt(0).toUpperCase()
                  }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="font-mono text-lg text-fg truncate">@{{ org.name }}</h3>
                  <!-- Role badge -->
                  <span
                    v-if="org.role"
                    class="inline-block mt-1 px-2 py-0.5 text-xs font-mono rounded"
                    :class="getRoleBadgeClass(org.role)"
                  >
                    {{ org.role }}
                  </span>
                  <span
                    v-else-if="org.isLoadingDetails"
                    class="skeleton inline-block mt-1 h-5 w-16 rounded"
                  />
                </div>
              </div>

              <!-- Stats -->
              <div class="flex items-center gap-4 text-sm text-fg-muted">
                <div class="flex items-center gap-1.5">
                  <span class="i-carbon:cube w-4 h-4" aria-hidden="true" />
                  <span v-if="org.packageCount !== null">
                    {{
                      $t(
                        'user.orgs_page.packages_count',
                        { count: org.packageCount },
                        org.packageCount,
                      )
                    }}
                  </span>
                  <span v-else-if="org.isLoadingDetails" class="skeleton inline-block h-4 w-20" />
                  <span v-else class="text-fg-subtle">—</span>
                </div>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </ClientOnly>
  </main>
</template>
