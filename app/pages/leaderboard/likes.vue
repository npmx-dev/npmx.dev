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

const { data: leaderboardEntries } = await useFetch<LikesLeaderboardEntry[]>(
  '/api/leaderboard/likes',
  {
    default: () => [],
  },
)
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-3xl mx-auto">
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

      <ol v-else class="space-y-4 list-none m-0 p-0">
        <li v-for="entry in leaderboardEntries" :key="entry.subjectRef">
          <NuxtLink
            :to="packageRoute(entry.packageName)"
            class="block no-underline hover:no-underline"
          >
            <BaseCard class="flex items-center justify-between gap-4 min-w-0">
              <div class="flex items-center gap-4 min-w-0">
                <div
                  aria-hidden="true"
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/12 text-amber-700 font-mono text-sm dark:text-amber-300"
                >
                  #{{ entry.rank }}
                </div>
                <div class="min-w-0">
                  <p class="text-xs uppercase tracking-wider text-fg-muted mb-1">
                    {{ $t('leaderboard.likes.rank') }} {{ entry.rank }}
                  </p>
                  <p class="font-mono text-lg truncate" :title="entry.packageName">
                    {{ entry.packageName }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-3 shrink-0">
                <div class="text-end">
                  <p class="text-xs uppercase tracking-wider text-fg-muted mb-1">
                    {{ $t('leaderboard.likes.likes') }}
                  </p>
                  <p class="font-mono text-lg">
                    {{ compactNumberFormatter.format(entry.totalLikes) }}
                  </p>
                </div>
                <span aria-hidden="true" class="text-fg-muted">↗</span>
              </div>
            </BaseCard>
          </NuxtLink>
        </li>
      </ol>
    </article>
  </main>
</template>
