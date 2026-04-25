<script setup lang="ts">
import type { LikesLeaderboardEntry } from '#shared/types/social'

useSeoMeta({
  title: () => `${$t('leaderboard.likes.title')} - npmx`,
  ogTitle: () => `${$t('leaderboard.likes.title')} - npmx`,
  twitterTitle: () => `${$t('leaderboard.likes.title')} - npmx`,
  description: () => $t('leaderboard.likes.description'),
  ogDescription: () => $t('leaderboard.likes.description'),
  twitterDescription: () => $t('leaderboard.likes.description'),
})

const compactNumberFormatter = useCompactNumberFormatter()

const { data: leaderboardEntries, status: leaderboardStatus } = useFetch<LikesLeaderboardEntry[]>(
  '/api/leaderboard/likes',
  {
    default: () => [],
    server: false,
  },
)

const hasResolvedLeaderboardRequest = shallowRef(false)

// Only show the skeleton for the first unresolved request. If this fetch runs
// again after content is already on screen, keep the current UI to avoid
// collapsing back to placeholders and causing layout shift.
watchEffect(() => {
  if (leaderboardStatus.value === 'success' || leaderboardStatus.value === 'error') {
    hasResolvedLeaderboardRequest.value = true
  }
})

const isLoadingLeaderboard = computed(
  () =>
    !hasResolvedLeaderboardRequest.value &&
    (leaderboardStatus.value === 'pending' || leaderboardStatus.value === 'idle'),
)

const highlightedEntries = computed(() => leaderboardEntries.value.slice(0, 3))
const remainingEntries = computed(() => leaderboardEntries.value.slice(3))

function getPreviewFallbackClass(rank: number): string {
  switch (rank) {
    case 1:
      return 'from-amber-500/20 via-amber-500/8 to-bg-subtle'
    case 2:
      return 'from-slate-400/20 via-slate-400/8 to-bg-subtle'
    case 3:
      return 'from-orange-500/20 via-orange-500/8 to-bg-subtle'
    default:
      return 'from-bg-muted to-bg-subtle'
  }
}

function getMedalBadgeClass(rank: number): string {
  switch (rank) {
    case 1:
      return 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300'
    case 2:
      return 'border-slate-500/20 bg-slate-500/8 text-slate-700 dark:text-slate-300'
    case 3:
      return 'border-orange-500/20 bg-orange-500/8 text-orange-700 dark:text-orange-300'
    default:
      return 'border-border bg-bg-subtle text-fg-muted'
  }
}

function getPodiumItemClass(rank: number): string {
  switch (rank) {
    case 1:
      return 'lg:col-start-2 lg:row-start-1 lg:-translate-y-6'
    case 2:
      return 'lg:col-start-1 lg:row-start-1 lg:translate-y-8'
    case 3:
      return 'lg:col-start-3 lg:row-start-1 lg:translate-y-14'
    default:
      return ''
  }
}

function getPodiumCardClass(rank: number): string {
  switch (rank) {
    case 1:
      return 'lg:scale-[1.03] lg:shadow-lg'
    default:
      return ''
  }
}

function formatCompactStat(value: number | null): string | null {
  if (value == null) return null
  return compactNumberFormatter.value.format(value)
}
</script>

<template>
  <main class="container w-full flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="mx-auto w-full max-w-5xl">
      <header class="mb-10">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('leaderboard.likes.title') }}
          </h1>
          <BackButton />
        </div>
        <p class="text-fg-muted text-lg">
          {{ $t('leaderboard.likes.description') }}
        </p>
      </header>

      <section
        v-if="isLoadingLeaderboard"
        aria-busy="true"
        :aria-label="$t('common.loading')"
        class="space-y-12"
      >
        <ol class="list-none m-0 space-y-4 p-0 pb-4 lg:hidden">
          <li v-for="rank in [1, 2, 3]" :key="rank" class="space-y-4">
            <div class="flex justify-center">
              <div
                class="inline-flex items-center rounded-full border px-3.5 py-2 text-lg font-mono shadow-sm"
                :class="getMedalBadgeClass(rank)"
              >
                <span>#{{ rank }}</span>
              </div>
            </div>
            <BaseCard
              class="h-full w-full overflow-hidden p-0 cursor-default hover:(border-border bg-bg-subtle)"
              :class="getPodiumCardClass(rank)"
            >
              <div class="border-b border-border">
                <SkeletonBlock class="aspect-[1.91/1] w-full" />
              </div>
              <div class="space-y-4 px-4 pt-4 pb-1">
                <div class="flex items-end justify-between gap-4">
                  <div class="min-w-0">
                    <SkeletonBlock class="h-7 w-28" />
                  </div>
                  <div class="shrink-0 text-end">
                    <p class="mb-1 text-xs uppercase tracking-wider text-fg-muted">
                      {{ $t('leaderboard.likes.likes') }}
                    </p>
                    <SkeletonBlock class="ms-auto h-7 w-12" />
                  </div>
                </div>
                <dl class="m-0 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
                  <div class="flex items-center gap-1.5">
                    <span aria-hidden="true" class="i-lucide:star h-3.5 w-3.5 opacity-0" />
                    <SkeletonBlock class="h-5 w-12" />
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span aria-hidden="true" class="i-lucide:chart-line h-3.5 w-3.5 opacity-0" />
                    <SkeletonBlock class="h-5 w-16" />
                  </div>
                </dl>
              </div>
            </BaseCard>
          </li>
        </ol>

        <ol
          class="hidden list-none m-0 gap-4 p-0 pb-4 lg:grid lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.08fr)_minmax(0,0.96fr)] lg:items-end lg:gap-6 lg:pb-16"
        >
          <li
            v-for="rank in [1, 2, 3]"
            :key="rank"
            class="space-y-4"
            :class="getPodiumItemClass(rank)"
          >
            <div class="flex justify-center">
              <div
                class="inline-flex items-center rounded-full border px-3.5 py-2 text-lg font-mono shadow-sm"
                :class="getMedalBadgeClass(rank)"
              >
                <span>#{{ rank }}</span>
              </div>
            </div>
            <BaseCard
              class="h-full w-full overflow-hidden p-0 cursor-default hover:(border-border bg-bg-subtle)"
              :class="getPodiumCardClass(rank)"
            >
              <div class="border-b border-border">
                <SkeletonBlock class="aspect-[1.91/1] w-full" />
              </div>
              <div class="space-y-4 px-4 pt-4 pb-1">
                <div class="flex items-end justify-between gap-4">
                  <div class="min-w-0">
                    <SkeletonBlock class="h-7 w-28" />
                  </div>
                  <div class="shrink-0 text-end">
                    <p class="mb-1 text-xs uppercase tracking-wider text-fg-muted">
                      {{ $t('leaderboard.likes.likes') }}
                    </p>
                    <SkeletonBlock class="ms-auto h-7 w-12" />
                  </div>
                </div>
                <dl class="m-0 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
                  <div class="flex items-center gap-1.5">
                    <span aria-hidden="true" class="i-lucide:star h-3.5 w-3.5 opacity-0" />
                    <SkeletonBlock class="h-5 w-12" />
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span aria-hidden="true" class="i-lucide:chart-line h-3.5 w-3.5 opacity-0" />
                    <SkeletonBlock class="h-5 w-16" />
                  </div>
                </dl>
              </div>
            </BaseCard>
          </li>
        </ol>

        <ol class="list-none m-0 space-y-4 p-0 pt-2">
          <li v-for="rank in [4, 5, 6, 7, 8, 9, 10]" :key="rank">
            <BaseCard
              class="flex w-full items-center justify-between gap-4 min-w-0 cursor-default hover:(border-border bg-bg-subtle)"
            >
              <div class="flex items-center gap-4 min-w-0">
                <div
                  aria-hidden="true"
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent font-mono text-sm"
                >
                  #{{ rank }}
                </div>
                <div
                  aria-hidden="true"
                  class="hidden h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-bg-subtle/70 p-2 sm:flex"
                >
                  <SkeletonBlock class="h-8 w-8 rounded-lg" />
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 min-w-0">
                    <div
                      aria-hidden="true"
                      class="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-bg-subtle/70 p-1 sm:hidden"
                    >
                      <SkeletonBlock class="h-4 w-4 rounded-sm" />
                    </div>
                    <SkeletonBlock class="h-7 w-28" />
                  </div>
                  <SkeletonBlock class="mt-1 h-6 w-48" />
                  <div
                    class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted"
                  >
                    <div class="flex items-center gap-1.5">
                      <span aria-hidden="true" class="i-lucide:star h-3.5 w-3.5 opacity-0" />
                      <SkeletonBlock class="h-5 w-12" />
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span aria-hidden="true" class="i-lucide:chart-line h-3.5 w-3.5 opacity-0" />
                      <SkeletonBlock class="h-5 w-16" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="shrink-0 text-end">
                <p class="mb-1 text-3xs font-medium uppercase tracking-[0.18em] text-fg">
                  {{ $t('leaderboard.likes.likes') }}
                </p>
                <SkeletonBlock class="ms-auto mt-2 h-8 w-12" />
              </div>
            </BaseCard>
          </li>
        </ol>
      </section>

      <BaseCard
        v-else-if="leaderboardEntries.length === 0"
        class="cursor-default hover:(border-border bg-bg-subtle)"
      >
        <h2 class="font-mono text-lg mb-2">
          {{ $t('leaderboard.likes.unavailable_title') }}
        </h2>
        <p class="text-fg-muted">
          {{ $t('leaderboard.likes.unavailable_description') }}
        </p>
      </BaseCard>

      <section v-else class="space-y-12">
        <ol class="list-none m-0 space-y-4 p-0 pb-4 lg:hidden">
          <li v-for="entry in highlightedEntries" :key="entry.subjectRef" class="space-y-4">
            <div class="flex justify-center">
              <div
                class="inline-flex items-center rounded-full border px-3.5 py-2 text-lg font-mono shadow-sm"
                :class="getMedalBadgeClass(entry.rank)"
              >
                <span>#{{ entry.rank }}</span>
              </div>
            </div>

            <NuxtLink
              :to="packageRoute(entry.packageName)"
              class="block h-full w-full no-underline text-inherit hover:no-underline"
            >
              <BaseCard
                class="h-full w-full overflow-hidden p-0 transition-transform"
                :class="getPodiumCardClass(entry.rank)"
              >
                <div class="border-b border-border">
                  <img
                    v-if="entry.homepagePreviewUrl"
                    :src="entry.homepagePreviewUrl"
                    alt=""
                    loading="lazy"
                    :width="entry.homepagePreviewWidth ?? undefined"
                    :height="entry.homepagePreviewHeight ?? undefined"
                    class="block aspect-[1.91/1] h-auto w-full object-cover"
                  />
                  <div
                    v-else
                    class="flex aspect-[1.91/1] items-end bg-gradient-to-br p-4"
                    :class="getPreviewFallbackClass(entry.rank)"
                  >
                    <p class="max-w-full break-all font-mono text-lg text-balance text-fg">
                      {{ entry.packageName }}
                    </p>
                  </div>
                </div>

                <div class="space-y-4 px-4 pt-4 pb-1">
                  <div class="flex items-end justify-between gap-4">
                    <div class="min-w-0">
                      <p class="truncate font-mono text-lg" :title="entry.packageName">
                        {{ entry.packageName }}
                      </p>
                    </div>

                    <div class="shrink-0 text-end">
                      <p class="mb-1 text-xs uppercase tracking-wider text-fg-muted">
                        {{ $t('leaderboard.likes.likes') }}
                      </p>
                      <p class="font-mono text-lg">
                        {{ compactNumberFormatter.format(entry.totalLikes) }}
                      </p>
                    </div>
                  </div>
                  <dl
                    v-if="entry.repositoryStars != null || entry.weeklyDownloads != null"
                    class="m-0 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted"
                  >
                    <div v-if="entry.repositoryStars != null" class="flex items-center gap-1.5">
                      <dt class="sr-only">{{ $t('command_palette.package_links.stars') }}</dt>
                      <dd class="flex items-center gap-1.5">
                        <span aria-hidden="true" class="i-lucide:star h-3.5 w-3.5" />
                        <span class="font-mono">{{
                          formatCompactStat(entry.repositoryStars)
                        }}</span>
                      </dd>
                    </div>
                    <div v-if="entry.weeklyDownloads != null" class="flex items-center gap-1.5">
                      <dt class="sr-only">{{ $t('package.card.weekly_downloads') }}</dt>
                      <dd class="flex items-center gap-1.5">
                        <span aria-hidden="true" class="i-lucide:chart-line h-3.5 w-3.5" />
                        <span class="font-mono">
                          {{ formatCompactStat(entry.weeklyDownloads)
                          }}{{ $t('common.per_week_short') }}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </BaseCard>
            </NuxtLink>
          </li>
        </ol>

        <ol
          data-testid="likes-leaderboard-desktop-podium"
          class="hidden list-none m-0 gap-4 p-0 pb-4 lg:grid lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.08fr)_minmax(0,0.96fr)] lg:items-end lg:gap-6 lg:pb-16"
        >
          <li
            v-for="entry in highlightedEntries"
            :key="entry.subjectRef"
            class="space-y-4"
            :class="getPodiumItemClass(entry.rank)"
          >
            <div class="flex justify-center">
              <div
                class="inline-flex items-center rounded-full border px-3.5 py-2 text-lg font-mono shadow-sm"
                :class="getMedalBadgeClass(entry.rank)"
              >
                <span>#{{ entry.rank }}</span>
              </div>
            </div>

            <NuxtLink
              :to="packageRoute(entry.packageName)"
              class="block h-full w-full no-underline text-inherit hover:no-underline"
            >
              <BaseCard
                class="h-full w-full overflow-hidden p-0 transition-transform"
                :class="getPodiumCardClass(entry.rank)"
              >
                <div class="border-b border-border">
                  <img
                    v-if="entry.homepagePreviewUrl"
                    :src="entry.homepagePreviewUrl"
                    alt=""
                    loading="lazy"
                    :width="entry.homepagePreviewWidth ?? undefined"
                    :height="entry.homepagePreviewHeight ?? undefined"
                    class="block aspect-[1.91/1] h-auto w-full object-cover"
                  />
                  <div
                    v-else
                    class="flex aspect-[1.91/1] items-end bg-gradient-to-br p-4"
                    :class="getPreviewFallbackClass(entry.rank)"
                  >
                    <p class="max-w-full break-all font-mono text-lg text-balance text-fg">
                      {{ entry.packageName }}
                    </p>
                  </div>
                </div>

                <div class="space-y-4 px-4 pt-4 pb-1">
                  <div class="flex items-end justify-between gap-4">
                    <div class="min-w-0">
                      <p class="truncate font-mono text-lg" :title="entry.packageName">
                        {{ entry.packageName }}
                      </p>
                    </div>

                    <div class="shrink-0 text-end">
                      <p class="mb-1 text-xs uppercase tracking-wider text-fg-muted">
                        {{ $t('leaderboard.likes.likes') }}
                      </p>
                      <p class="font-mono text-lg">
                        {{ compactNumberFormatter.format(entry.totalLikes) }}
                      </p>
                    </div>
                  </div>
                  <dl
                    v-if="entry.repositoryStars != null || entry.weeklyDownloads != null"
                    class="m-0 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted"
                  >
                    <div v-if="entry.repositoryStars != null" class="flex items-center gap-1.5">
                      <dt class="sr-only">{{ $t('command_palette.package_links.stars') }}</dt>
                      <dd class="flex items-center gap-1.5">
                        <span aria-hidden="true" class="i-lucide:star h-3.5 w-3.5" />
                        <span class="font-mono">{{
                          formatCompactStat(entry.repositoryStars)
                        }}</span>
                      </dd>
                    </div>
                    <div v-if="entry.weeklyDownloads != null" class="flex items-center gap-1.5">
                      <dt class="sr-only">{{ $t('package.card.weekly_downloads') }}</dt>
                      <dd class="flex items-center gap-1.5">
                        <span aria-hidden="true" class="i-lucide:chart-line h-3.5 w-3.5" />
                        <span class="font-mono">
                          {{ formatCompactStat(entry.weeklyDownloads)
                          }}{{ $t('common.per_week_short') }}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </BaseCard>
            </NuxtLink>
          </li>
        </ol>

        <ol
          v-if="remainingEntries.length > 0"
          :start="highlightedEntries.length + 1"
          class="list-none m-0 space-y-4 p-0 pt-2"
        >
          <li v-for="entry in remainingEntries" :key="entry.subjectRef">
            <NuxtLink
              :to="packageRoute(entry.packageName)"
              class="block w-full no-underline hover:no-underline"
            >
              <BaseCard class="flex w-full items-center justify-between gap-4 min-w-0">
                <div class="flex items-center gap-4 min-w-0">
                  <div
                    aria-hidden="true"
                    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent font-mono text-sm"
                  >
                    #{{ entry.rank }}
                  </div>
                  <div
                    v-if="entry.homepageLogoUrl"
                    aria-hidden="true"
                    class="hidden h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-bg-subtle/70 p-2 sm:flex"
                  >
                    <img
                      :src="entry.homepageLogoUrl"
                      alt=""
                      loading="lazy"
                      :width="entry.homepageLogoWidth ?? undefined"
                      :height="entry.homepageLogoHeight ?? undefined"
                      class="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 min-w-0">
                      <div
                        v-if="entry.homepageLogoUrl"
                        aria-hidden="true"
                        class="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-bg-subtle/70 p-1 sm:hidden"
                      >
                        <img
                          :src="entry.homepageLogoUrl"
                          alt=""
                          loading="lazy"
                          :width="entry.homepageLogoWidth ?? undefined"
                          :height="entry.homepageLogoHeight ?? undefined"
                          class="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <p class="min-w-0 font-mono text-lg truncate" :title="entry.packageName">
                        <span class="sr-only"
                          >{{ $t('leaderboard.likes.rank') }} {{ entry.rank }}.
                        </span>
                        {{ entry.packageName }}
                      </p>
                    </div>
                    <p
                      v-if="entry.packageDescription"
                      class="mt-1 line-clamp-2 sm:line-clamp-1 text-base text-fg-muted"
                      :title="entry.packageDescription"
                    >
                      {{ entry.packageDescription }}
                    </p>
                    <dl
                      v-if="entry.repositoryStars != null || entry.weeklyDownloads != null"
                      class="m-0 mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted"
                    >
                      <div v-if="entry.repositoryStars != null" class="flex items-center gap-1.5">
                        <dt class="sr-only">{{ $t('command_palette.package_links.stars') }}</dt>
                        <dd class="flex items-center gap-1.5">
                          <span aria-hidden="true" class="i-lucide:star h-3.5 w-3.5" />
                          <span class="font-mono">{{
                            formatCompactStat(entry.repositoryStars)
                          }}</span>
                        </dd>
                      </div>
                      <div v-if="entry.weeklyDownloads != null" class="flex items-center gap-1.5">
                        <dt class="sr-only">{{ $t('package.card.weekly_downloads') }}</dt>
                        <dd class="flex items-center gap-1.5">
                          <span aria-hidden="true" class="i-lucide:chart-line h-3.5 w-3.5" />
                          <span class="font-mono">
                            {{ formatCompactStat(entry.weeklyDownloads)
                            }}{{ $t('common.per_week_short') }}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div class="shrink-0 text-end">
                  <div>
                    <p class="mb-1 text-3xs font-medium uppercase tracking-[0.18em] text-fg">
                      {{ $t('leaderboard.likes.likes') }}
                    </p>
                    <p class="font-mono text-2xl leading-none">
                      {{ compactNumberFormatter.format(entry.totalLikes) }}
                    </p>
                  </div>
                </div>
              </BaseCard>
            </NuxtLink>
          </li>
        </ol>
      </section>
    </article>
  </main>
</template>
