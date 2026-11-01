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

const { data: leaderboardEntries } = useFetch<LikesLeaderboardEntry[]>('/api/leaderboard/likes', {
  default: () => [],
})

const shouldAnimateEntries = ref(false)
const highlightedEntries = computed(() => leaderboardEntries.value.slice(0, 3))
const remainingEntries = computed(() => leaderboardEntries.value.slice(3))

onMounted(() => {
  shouldAnimateEntries.value = true
})

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

function getResponsivePodiumItemClass(rank: number): string {
  switch (rank) {
    case 1:
      return 'md:col-span-2'
    default:
      return 'md:max-w-none'
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

function getEntryAnimationStyle(index: number): Record<string, string> {
  return {
    animationDelay: `${Math.min(index * 100, 600)}ms`,
  }
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

      <BaseCard
        v-if="leaderboardEntries.length === 0"
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
        <ol
          class="grid list-none m-0 grid-cols-1 gap-8 p-0 pb-4 md:grid-cols-2 md:items-start lg:hidden"
        >
          <li
            v-for="(entry, index) in highlightedEntries"
            :key="entry.subjectRef"
            class="mx-auto w-full max-w-xl"
            :class="getResponsivePodiumItemClass(entry.rank)"
          >
            <div
              class="space-y-4"
              :class="{ 'likes-leaderboard-entry-motion': shouldAnimateEntries }"
              :style="getEntryAnimationStyle(index)"
            >
              <div class="flex justify-center">
                <div
                  class="inline-flex h-12 w-12 items-center justify-center rounded-full border text-lg font-mono shadow-sm"
                  :class="getMedalBadgeClass(entry.rank)"
                >
                  <span>#{{ entry.rank }}</span>
                </div>
              </div>

              <NuxtLink
                :to="packageRoute(entry.packageName)"
                class="leaderboard-package-link block w-full rounded-lg no-underline text-inherit hover:no-underline focus-visible:outline-none"
              >
                <BaseCard
                  class="leaderboard-package-card w-full overflow-hidden p-0! transition-[border-color,background-color,outline-color,transform]"
                  :class="getPodiumCardClass(entry.rank)"
                >
                  <div class="-mx-px -mt-px overflow-hidden rounded-t-lg border-b border-border">
                    <img
                      v-if="entry.homepagePreviewUrl"
                      :src="entry.homepagePreviewUrl"
                      alt=""
                      loading="eager"
                      :fetchpriority="entry.rank === 1 ? 'high' : 'auto'"
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

                  <div
                    class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-5 py-5 sm:px-6"
                  >
                    <div class="min-w-0 space-y-3">
                      <p class="truncate font-mono text-xl" :title="entry.packageName">
                        {{ entry.packageName }}
                      </p>
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

                    <div class="shrink-0 text-end">
                      <p class="mb-2 text-xs uppercase tracking-wider text-fg-muted">
                        {{ $t('leaderboard.likes.likes') }}
                      </p>
                      <p class="font-mono text-2xl leading-none">
                        {{ compactNumberFormatter.format(entry.totalLikes) }}
                      </p>
                    </div>
                  </div>
                </BaseCard>
              </NuxtLink>
            </div>
          </li>
        </ol>

        <ol
          data-testid="likes-leaderboard-desktop-podium"
          class="hidden list-none m-0 gap-4 p-0 pb-4 lg:grid lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.08fr)_minmax(0,0.96fr)] lg:items-end lg:gap-6 lg:pb-16"
        >
          <li
            v-for="(entry, index) in highlightedEntries"
            :key="entry.subjectRef"
            :class="getPodiumItemClass(entry.rank)"
          >
            <div
              class="space-y-4"
              :class="{ 'likes-leaderboard-entry-motion': shouldAnimateEntries }"
              :style="getEntryAnimationStyle(index)"
            >
              <div class="flex justify-center">
                <div
                  class="inline-flex h-12 w-12 items-center justify-center rounded-full border text-lg font-mono shadow-sm"
                  :class="getMedalBadgeClass(entry.rank)"
                >
                  <span>#{{ entry.rank }}</span>
                </div>
              </div>

              <NuxtLink
                :to="packageRoute(entry.packageName)"
                class="leaderboard-package-link block h-full w-full rounded-lg no-underline text-inherit hover:no-underline focus-visible:outline-none"
              >
                <BaseCard
                  class="leaderboard-package-card h-full w-full overflow-hidden p-0! transition-[border-color,background-color,outline-color,transform]"
                  :class="getPodiumCardClass(entry.rank)"
                >
                  <div class="-mx-px -mt-px overflow-hidden rounded-t-lg border-b border-border">
                    <img
                      v-if="entry.homepagePreviewUrl"
                      :src="entry.homepagePreviewUrl"
                      alt=""
                      loading="eager"
                      :fetchpriority="entry.rank === 1 ? 'high' : 'auto'"
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

                  <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-5 py-5">
                    <div class="min-w-0 space-y-3">
                      <p class="truncate font-mono text-xl" :title="entry.packageName">
                        {{ entry.packageName }}
                      </p>
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

                    <div class="shrink-0 text-end">
                      <p class="mb-2 text-xs uppercase tracking-wider text-fg-muted">
                        {{ $t('leaderboard.likes.likes') }}
                      </p>
                      <p class="font-mono text-2xl leading-none">
                        {{ compactNumberFormatter.format(entry.totalLikes) }}
                      </p>
                    </div>
                  </div>
                </BaseCard>
              </NuxtLink>
            </div>
          </li>
        </ol>

        <ol
          v-if="remainingEntries.length > 0"
          :start="highlightedEntries.length + 1"
          class="list-none m-0 space-y-4 p-0 pt-2"
        >
          <li
            v-for="(entry, index) in remainingEntries"
            :key="entry.subjectRef"
            :class="{ 'likes-leaderboard-entry-motion': shouldAnimateEntries }"
            :style="getEntryAnimationStyle(index + highlightedEntries.length)"
          >
            <NuxtLink
              :to="packageRoute(entry.packageName)"
              class="leaderboard-package-link block w-full rounded-lg no-underline hover:no-underline focus-visible:outline-none"
            >
              <BaseCard
                class="leaderboard-package-card flex w-full items-center justify-between gap-4 min-w-0"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <div
                    aria-hidden="true"
                    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent font-mono text-sm"
                  >
                    #{{ entry.rank }}
                  </div>
                  <div
                    aria-hidden="true"
                    class="hidden h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-bg-subtle/70 p-2 sm:flex"
                  >
                    <img
                      v-if="entry.homepageLogoUrl"
                      :src="entry.homepageLogoUrl"
                      alt=""
                      loading="lazy"
                      :width="entry.homepageLogoWidth ?? undefined"
                      :height="entry.homepageLogoHeight ?? undefined"
                      class="max-h-full max-w-full rounded-sm object-contain"
                    />
                    <span v-else class="i-lucide:package h-6 w-6 text-fg-muted" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 min-w-0">
                      <div
                        aria-hidden="true"
                        class="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-bg-subtle/70 p-1 sm:hidden"
                      >
                        <img
                          v-if="entry.homepageLogoUrl"
                          :src="entry.homepageLogoUrl"
                          alt=""
                          loading="lazy"
                          :width="entry.homepageLogoWidth ?? undefined"
                          :height="entry.homepageLogoHeight ?? undefined"
                          class="max-h-full max-w-full rounded-sm object-contain"
                        />
                        <span v-else class="i-lucide:package h-3.5 w-3.5 text-fg-muted" />
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
                    <p class="mb-1 text-3xs font-medium uppercase tracking-[0.18em] text-fg-muted">
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

<style scoped>
.leaderboard-package-card {
  outline: 2px solid transparent;
  outline-offset: 2px;
}

.leaderboard-package-link:focus-visible .leaderboard-package-card {
  background: var(--bg-muted);
  border-color: var(--border-hover);
  outline-color: color-mix(in oklab, var(--fg) 60%, transparent);
}

.likes-leaderboard-entry-motion {
  animation: likes-leaderboard-pop-in 0.8s cubic-bezier(0.16, 0.3, 0.3, 1) both;
  transform-origin: center top;
  will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
  .likes-leaderboard-entry-motion {
    animation: none;
    will-change: auto;
  }
}

@keyframes likes-leaderboard-pop-in {
  from {
    transform: translate3d(0, 20px, 0) scale(0.96);
  }

  50% {
    transform: translate3d(0, -6px, 0) scale(1.02);
  }

  70% {
    transform: translate3d(0, 2px, 0) scale(0.998);
  }

  to {
    transform: translate3d(0, 0, 0) scale(1);
  }
}
</style>
