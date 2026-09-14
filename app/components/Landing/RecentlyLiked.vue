<script setup lang="ts">
import type { RecentPackageLike } from '~/utils/recent-package-likes'
import { RECENT_PACKAGE_LIKES_LIMIT } from '~/utils/recent-package-likes'

const props = defineProps<{
  isLoading?: boolean
  likes: readonly RecentPackageLike[]
}>()

const LIKE_CARD_CLASSES = [
  'grid h-full min-h-[7rem] content-start grid-cols-[minmax(0,1fr)_auto]',
  'gap-x-3 gap-y-1 rounded-md border border-border bg-bg/70 px-3.5 py-3',
  'text-start text-base text-fg shadow-sm transition-colors duration-200',
  'hover:border-border-hover hover:bg-bg-elevated focus-within:border-accent',
]

const SKELETON_CARD_CLASSES = [
  'grid min-h-[7rem] grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-3',
  'rounded-md border border-border bg-bg/70 px-3.5 py-3',
]

const compactNumberFormatter = useCompactNumberFormatter()

const skeletonRows = Array.from({ length: RECENT_PACKAGE_LIKES_LIMIT }, (_, index) => index)
const hasLiveLike = computed(() => props.likes.some(like => like.origin === 'live'))
const liveRegionPackageName = shallowRef('')
const loadingPlaceholderRows = computed(() => {
  if (!props.isLoading || props.likes.length === 0) return []
  return Array.from(
    { length: Math.max(0, RECENT_PACKAGE_LIKES_LIMIT - props.likes.length) },
    (_, index) => index,
  )
})

function formatCompactStat(value: number | null | undefined): string | null {
  if (value == null) return null
  return compactNumberFormatter.value.format(value)
}

watch(
  () => props.likes,
  (likes, previousLikes = []) => {
    const previousLikeIds = new Set(previousLikes.map(like => like.id))
    const newLike = likes.find(
      like => like.origin === 'live' && like.animateEntry && !previousLikeIds.has(like.id),
    )
    if (!newLike) return

    liveRegionPackageName.value = newLike.packageName
  },
  { flush: 'post' },
)
</script>

<template>
  <section
    class="w-full max-w-4xl motion-safe:animate-slide-up motion-safe:animate-fill-both"
    aria-labelledby="recently-liked-title"
    data-testid="recently-liked-packages"
  >
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{
        liveRegionPackageName
          ? $t('home.recently_liked.announcement', { packageName: liveRegionPackageName })
          : ''
      }}
    </p>

    <div
      class="relative overflow-hidden rounded-lg border border-border bg-bg-subtle/85 backdrop-blur"
      :aria-busy="isLoading ? 'true' : undefined"
    >
      <div
        class="absolute inset-bs-0 inset-is-0 h-px w-full bg-gradient-to-r from-transparent via-accent/70 to-transparent"
        aria-hidden="true"
      />
      <div class="border-b border-border/70 px-3 py-2.5 sm:px-3.5">
        <div class="flex items-center gap-2 text-start">
          <span
            class="relative flex size-2.5"
            :class="hasLiveLike ? 'text-[var(--badge-green)]' : 'text-[var(--badge-blue)]'"
            aria-hidden="true"
          >
            <span
              class="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none"
            />
            <span class="relative inline-flex size-2.5 rounded-full bg-current" />
          </span>
          <h2 id="recently-liked-title" class="text-sm font-mono uppercase text-fg-muted">
            {{ $t('home.recently_liked.title') }}
          </h2>
        </div>
      </div>

      <TransitionGroup
        v-if="likes.length > 0"
        tag="ul"
        name="recently-liked-list"
        class="grid list-none m-0 gap-2 p-2.5"
      >
        <li v-for="like in likes" :key="like.id" class="min-w-0">
          <article
            :class="[
              LIKE_CARD_CLASSES,
              like.animateEntry || like.origin === 'live' ? 'recently-liked-entry' : undefined,
            ]"
          >
            <NuxtLink
              :to="packageRoute(like.packageName)"
              class="block min-w-0 text-fg no-underline hover:text-fg hover:no-underline"
              data-testid="recently-liked-package"
            >
              <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span
                  class="min-w-0 truncate font-mono leading-6"
                  dir="ltr"
                  :title="like.packageName"
                >
                  {{ like.packageName }}
                </span>
                <span class="shrink-0 text-xs text-fg-subtle" data-testid="recently-liked-time">
                  {{ $t('home.recently_liked.liked_prefix') }}
                  <DateTime
                    :datetime="new Date(like.likedAt)"
                    date-style="short"
                    time-style="short"
                  />
                </span>
              </div>

              <p
                v-if="like.packageDescription"
                class="mt-0.5 mb-0 line-clamp-2 text-sm text-fg-muted"
              >
                {{ like.packageDescription }}
              </p>
            </NuxtLink>

            <div class="flex items-start justify-end">
              <PackageLikes :package-name="like.packageName" />
            </div>

            <dl
              v-if="like.repositoryStars != null || like.weeklyDownloads != null"
              class="col-start-1 m-0 grid grid-cols-[6.25rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-sm text-fg-muted"
            >
              <div class="min-w-0">
                <template v-if="like.repositoryStars != null">
                  <dt class="sr-only">{{ $t('command_palette.package_links.stars') }}</dt>
                  <dd class="m-0 flex min-w-0 items-center gap-1.5">
                    <span aria-hidden="true" class="i-lucide:star size-4 shrink-0" />
                    <span class="truncate font-mono">
                      {{ formatCompactStat(like.repositoryStars) }}
                    </span>
                  </dd>
                </template>
              </div>
              <div v-if="like.weeklyDownloads != null" class="flex items-center gap-1.5">
                <dt class="sr-only">{{ $t('package.card.weekly_downloads') }}</dt>
                <dd class="m-0 flex items-center gap-1.5">
                  <span aria-hidden="true" class="i-lucide:chart-line size-4" />
                  <span class="font-mono">
                    {{ formatCompactStat(like.weeklyDownloads) }}{{ $t('common.per_week_short') }}
                  </span>
                </dd>
              </div>
            </dl>
          </article>
        </li>
        <li
          v-for="row in loadingPlaceholderRows"
          :key="`loading-placeholder-${row}`"
          class="min-w-0"
          aria-hidden="true"
        >
          <article :class="SKELETON_CARD_CLASSES">
            <div class="min-w-0 space-y-2.5">
              <div class="flex items-center gap-2">
                <span
                  class="h-5 w-[10.5rem] max-w-[55%] rounded bg-fg/12 motion-safe:animate-pulse"
                />
                <span class="h-3.5 w-[5.5rem] rounded bg-fg/8 motion-safe:animate-pulse" />
              </div>
              <span class="block h-3.5 w-11/12 rounded bg-fg/8 motion-safe:animate-pulse" />
            </div>
            <span class="h-8 w-14 rounded-md border border-border bg-bg-subtle" />
            <span class="col-start-1 h-3.5 w-[9rem] rounded bg-fg/8 motion-safe:animate-pulse" />
          </article>
        </li>
      </TransitionGroup>

      <ul
        v-else-if="isLoading"
        class="grid list-none m-0 gap-2 p-2.5"
        data-testid="recently-liked-skeleton"
      >
        <li v-for="row in skeletonRows" :key="row" class="min-w-0" aria-hidden="true">
          <article :class="SKELETON_CARD_CLASSES">
            <div class="min-w-0 space-y-2.5">
              <div class="flex items-center gap-2">
                <span
                  class="h-5 w-[10.5rem] max-w-[55%] rounded bg-fg/12 motion-safe:animate-pulse"
                />
                <span class="h-3.5 w-[5.5rem] rounded bg-fg/8 motion-safe:animate-pulse" />
              </div>
              <span class="block h-3.5 w-11/12 rounded bg-fg/8 motion-safe:animate-pulse" />
            </div>
            <span class="h-8 w-14 rounded-md border border-border bg-bg-subtle" />
            <span class="col-start-1 h-3.5 w-[9rem] rounded bg-fg/8 motion-safe:animate-pulse" />
          </article>
        </li>
      </ul>

      <div v-else class="p-2.5">
        <div
          class="flex min-h-[7rem] items-center gap-3 rounded-md border border-border bg-bg/70 px-3.5 py-3 text-start text-base text-fg-muted"
          data-testid="recently-liked-empty"
        >
          <span class="i-lucide:radio-tower size-4 shrink-0 text-accent" aria-hidden="true" />
          <p class="m-0">{{ $t('home.recently_liked.empty') }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.recently-liked-entry {
  animation: recently-liked-entry 760ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.recently-liked-list-move {
  transition: transform 680ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes recently-liked-entry {
  0% {
    opacity: 0;
    transform: translateY(-0.5rem) scale(0.985);
    border-color: color-mix(in oklab, var(--accent) 70%, var(--border));
    background: color-mix(in oklab, var(--accent) 10%, var(--bg));
  }

  55% {
    opacity: 1;
    transform: translateY(0.125rem) scale(1.002);
    border-color: color-mix(in oklab, var(--accent) 45%, var(--border));
    background: color-mix(in oklab, var(--accent) 6%, var(--bg));
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    border-color: var(--border);
    background: color-mix(in oklab, var(--bg) 70%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .recently-liked-entry {
    animation: none;
  }

  .recently-liked-list-move {
    transition: none;
  }
}
</style>
