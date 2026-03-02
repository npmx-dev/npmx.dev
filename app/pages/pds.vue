<script setup lang="ts">
import type { AtprotoProfile } from '#shared/types/atproto'

const router = useRouter()
const canGoBack = useCanGoBack()

useSeoMeta({
  title: () => `${$t('pds.title')} - npmx`,
  ogTitle: () => `${$t('pds.title')} - npmx`,
  twitterTitle: () => `${$t('pds.title')} - npmx`,
  description: () => $t('pds.meta_description'),
  ogDescription: () => $t('pds.meta_description'),
  twitterDescription: () => $t('pds.meta_description'),
})

defineOgImageComponent('Default', {
  primaryColor: '#60a5fa',
  title: 'npmx.social',
  description: 'The official **PDS** for the npmx community.',
})

const brokenImages = ref(new Set<string>())

const handleImageError = (handle: string) => {
  brokenImages.value.add(handle)
}

const { data: pdsUsers, status: pdsStatus } = useLazyFetch<AtprotoProfile[]>(
  '/api/atproto/pds-users',
  {
    default: () => [],
  },
)

const usersWithAvatars = computed(() => {
  return pdsUsers.value.filter(user => user.avatar && !brokenImages.value.has(user.handle))
})

const usersWithoutAvatars = computed(() => {
  return pdsUsers.value.filter(user => !user.avatar || brokenImages.value.has(user.handle))
})

const totalAccounts = computed(() => pdsUsers.value.length)
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('pds.title') }}
          </h1>
          <button
            type="button"
            class="cursor-pointer inline-flex items-center gap-2 p-1.5 -mx-1.5 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70 shrink-0"
            @click="router.back()"
            v-if="canGoBack"
          >
            <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
            <span class="hidden sm:inline">{{ $t('nav.back') }}</span>
          </button>
        </div>
        <p class="text-fg-muted text-lg">
          {{ $t('pds.meta_description') }}
        </p>
      </header>

      <section class="max-w-none space-y-12">
        <div>
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('pds.join.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            {{ $t('pds.join.description') }}
          </p>
          <div class="mt-6">
            <LinkBase
              to="https://pdsmoover.com/moover/npmx.social"
              class="gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border hover:border-border-hover bg-bg-muted hover:bg-bg"
              no-underline
            >
              <span class="i-lucide:arrow-right-left w-4 h-4 text-fg-muted" aria-hidden="true" />
              {{ $t('pds.join.migrate') }}
            </LinkBase>
          </div>
        </div>

        <div>
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('pds.server.title') }}
          </h2>
          <ul class="space-y-3 text-fg-muted list-none p-0">
            <li class="flex items-start gap-3">
              <span
                class="i-lucide:map-pin shrink-0 mt-1 w-4 h-4 text-fg-subtle"
                aria-hidden="true"
              />
              <span>
                <strong class="text-fg">{{ $t('pds.server.location_label') }}</strong>
                {{ $t('pds.server.location_value') }}
              </span>
            </li>
            <li class="flex items-start gap-3">
              <span
                class="i-lucide:server shrink-0 mt-1 w-4 h-4 text-fg-subtle"
                aria-hidden="true"
              />
              <span>
                <strong class="text-fg">{{ $t('pds.server.infrastructure_label') }}</strong>
                {{ $t('pds.server.infrastructure_value') }}
              </span>
            </li>
            <li class="flex items-start gap-3">
              <span
                class="i-lucide:shield-check shrink-0 mt-1 w-4 h-4 text-fg-subtle"
                aria-hidden="true"
              />
              <span>
                <strong class="text-fg">{{ $t('pds.server.privacy_label') }}</strong>
                {{ $t('pds.server.privacy_value') }}
              </span>
            </li>
          </ul>
        </div>
        <div aria-labelledby="community-heading">
          <h2 id="community-heading" class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('pds.community.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-2">
            {{ $t('pds.community.description') }}
          </p>
          <p
            v-if="pdsStatus === 'success' && totalAccounts > 0"
            class="text-fg font-medium mb-6"
          >
            {{ $t('pds.community.account_count', { count: totalAccounts }) }}
          </p>
          <div v-else class="mb-6" />

          <div v-if="pdsStatus === 'pending'" class="text-fg-subtle text-sm" role="status">
            {{ $t('pds.community.loading') }}
          </div>
          <div v-else-if="pdsStatus === 'error'" class="text-fg-subtle text-sm" role="alert">
            {{ $t('pds.community.error') }}
          </div>
          <div v-else-if="!pdsUsers.length" class="text-fg-subtle text-sm">
            {{ $t('pds.community.empty') }}
          </div>
          <div v-else>
            <ul
              class="grid grid-cols-[repeat(auto-fill,48px)] justify-center gap-2 list-none p-0"
            >
              <li
                v-for="user in usersWithAvatars"
                :key="user.handle"
                class="block group relative"
              >
                <a
                  :href="`https://bsky.app/profile/${user.handle}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="$t('pds.community.view_profile', { handle: user.handle })"
                  class="block rounded-lg"
                >
                  <img
                    :src="user.avatar"
                    :alt="`${user.handle}'s avatar`"
                    @error="handleImageError(user.handle)"
                    width="48"
                    height="48"
                    class="w-12 h-12 rounded-lg ring-2 ring-transparent group-hover:ring-accent transition-all duration-200 ease-out group-hover:scale-125 will-change-transform"
                    loading="lazy"
                  />
                  <span
                    class="pointer-events-none absolute -top-9 inset-is-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-xs px-2 py-1 shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100"
                    dir="ltr"
                    role="tooltip"
                  >
                    @{{ user.handle }}
                  </span>
                </a>
              </li>
            </ul>
            <div
              v-if="usersWithoutAvatars.length"
              class="flex items-center justify-center gap-2 mt-4 text-fg-muted text-sm"
            >
              <AppMark class="w-5 h-auto" />
              <span>{{ $t('pds.community.new_accounts', { count: usersWithoutAvatars.length }) }}</span>
            </div>
          </div>
        </div>
      </section>
    </article>
  </main>
</template>
