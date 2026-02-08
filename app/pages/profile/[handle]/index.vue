<script setup lang="ts">
import { debounce } from 'perfect-debounce'
import { normalizeSearchParam } from '#shared/utils/url'

const route = useRoute('/profile/[handle]')
const router = useRouter()

const handle = computed(() => route.params.handle)

const { data: profile }: { data?: NPMXProfile } = useFetch(
  () => `/api/social/profile/${handle.value}`,
  {
    default: () => ({ profile: { displayName: handle.value } }),
    server: false,
  },
)

useSeoMeta({
  title: () => `${handle.value} - npmx`,
  description: () => `npmx profile by ${handle.value}`,
})

/**
defineOgImageComponent('Default', {
  title: () => `~${username.value}`,
  description: () => (results.value ? `${results.value.total} packages` : 'npm user profile'),
  primaryColor: '#60a5fa',
})
**/
</script>

<template>
  <main class="container flex-1 flex flex-col py-8 sm:py-12 w-full">
    <!-- Header -->
    <header class="mb-8 pb-8 border-b border-border">
      <div class="flex flex-wrap items-center gap-4">
        <div>
          <h1 class="font-mono text-2xl sm:text-3xl font-medium">{{ profile.displayName }}</h1>
          <h2>@{{ handle }}</h2>
          <p v-if="profile.description">{{ profile.description }}</p>
        </div>
      </div>
    </header>

    <!-- Empty state (no packages found for user) -->
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <p class="text-fg-muted font-mono">
          {{ $t('user.page.no_packages') }} <span class="text-fg">~{{ handle }}</span>
        </p>
        <p class="text-fg-subtle text-sm mt-2">{{ $t('user.page.no_packages_hint') }}</p>
      </div>
    </div>
  </main>
</template>
