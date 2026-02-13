<script setup lang="ts">
definePageMeta({
  name: 'vacations',
})

useSeoMeta({
  title: () => `${$t('vacations.title')} - npmx`,
  description: () => $t('vacations.meta_description'),
  ogTitle: () => `${$t('vacations.title')} - npmx`,
  ogDescription: () => $t('vacations.meta_description'),
  twitterTitle: () => `${$t('vacations.title')} - npmx`,
  twitterDescription: () => $t('vacations.meta_description'),
})

defineOgImageComponent('Default', {
  title: () => $t('vacations.title'),
  description: () => $t('vacations.meta_description'),
})

const router = useRouter()
const canGoBack = useCanGoBack()

const { data: stats } = useFetch('/api/repo-stats')

/**
 * Formats a number into a compact human-readable string.
 * e.g. 1142 → "1.1k+", 163 → "160+"
 */
function formatStat(n: number): string {
  if (n >= 1000) {
    const k = Math.floor(n / 100) / 10
    return `${k}k+`
  }
  return `${Math.floor(n / 10) * 10}+`
}

// --- Cosy fireplace easter egg ---
const logClicks = ref(0)
const fireVisible = ref(false)
function pokeLog() {
  logClicks.value++
  if (logClicks.value >= 3) {
    fireVisible.value = true
  }
}

// Icons that tile across the banner, repeating to fill.
// Classes must be written out statically so UnoCSS can detect them at build time.
const icons = [
  'i-lucide:snowflake',
  'i-lucide:mountain',
  'i-lucide:tree-pine',
  'i-lucide:coffee',
  'i-lucide:book',
  'i-lucide:music',
  'i-lucide:snowflake',
  'i-lucide:star',
  'i-lucide:moon',
] as const

// --- .ics calendar reminder ---

// Format as UTC for the .ics file
const fmt = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

// Pick a random daytime hour (9–17) in the user's local timezone on Feb 22
// so reminders are staggered and people don't all flood in at once.
function downloadIcs() {
  const hour = 9 + Math.floor(Math.random() * 9) // 9..17
  const start = new Date(2026, 1, 22, hour, 0, 0) // month is 0-indexed
  const end = new Date(2026, 1, 22, hour + 1, 0, 0)

  const uid = `npmx-vacations-${start.getTime()}@npmx.dev`

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//npmx//recharging//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:npmx Discord is back!`,
    `DESCRIPTION:The npmx team is back from vacation. Time to rejoin! https://chat.npmx.dev`,
    'STATUS:CONFIRMED',
    `UID:${uid}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'npmx-discord-reminder.ics'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden max-w-full">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="max-w-2xl mx-auto py-8 bg-none flex justify-center">
          <!-- Icon / Illustration -->
          <div class="relative inline-block">
            <div class="absolute inset-0 bg-accent/20 blur-3xl rounded-full" aria-hidden="true" />
            <span class="relative text-8xl sm:text-9xl animate-bounce-slow inline-block">🏖️</span>
          </div>
        </div>
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('vacations.heading') }}
          </h1>
          <button
            type="button"
            class="cursor-pointer inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70 shrink-0"
            @click="router.back()"
            v-if="canGoBack"
          >
            <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
            <span class="sr-only sm:not-sr-only">{{ $t('nav.back') }}</span>
          </button>
        </div>
        <i18n-t
          keypath="vacations.subtitle"
          tag="p"
          scope="global"
          class="text-fg-muted text-lg sm:text-xl"
        >
          <template #some>
            <span class="line-through decoration-fg">{{
              $t('vacations.stats.subtitle.some')
            }}</span>
            {{ ' ' }}
            <strong class="text-fg">{{ $t('vacations.stats.subtitle.all') }}</strong>
          </template>
        </i18n-t>
      </header>
      <!-- Bluesky post embed -->
      <div class="my-8">
        <BlueskyPostEmbed
          uri="at://did:plc:u5zp7npt5kpueado77kuihyz/app.bsky.feed.post/3mejzn5mrcc2g"
        />
      </div>

      <section class="prose prose-invert max-w-none space-y-8">
        <!-- What's happening -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('vacations.what.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="vacations.what.p1" tag="span" scope="global">
              <template #dates>
                <strong class="text-fg">{{ $t('vacations.what.dates') }}</strong>
              </template>
            </i18n-t>
          </p>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="vacations.what.p2" tag="span" scope="global">
              <template #garden>
                <code class="font-mono text-fg text-sm">{{ $t('vacations.what.garden') }}</code>
              </template>
            </i18n-t>
          </p>
        </div>

        <!-- In the meantime -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('vacations.meantime.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed">
            <i18n-t keypath="vacations.meantime.p1" tag="span" scope="global">
              <template #site>
                <LinkBase class="font-sans" to="/">npmx.dev</LinkBase>
              </template>
              <template #repo>
                <LinkBase class="font-sans" to="https://repo.npmx.dev">
                  {{ $t('vacations.meantime.repo_link') }}
                </LinkBase>
              </template>
            </i18n-t>
          </p>
        </div>

        <!-- Icon banner — a single row of cosy icons, clipped to fill width -->
        <div
          class="relative mb-12 px-4 border border-border rounded-lg bg-bg-subtle overflow-hidden select-none"
          :aria-label="$t('vacations.illustration_alt')"
          role="group"
        >
          <div class="flex items-center gap-4 sm:gap-5 py-3 sm:py-4 w-max">
            <template v-for="n in 4" :key="`set-${n}`">
              <!-- Campsite icon — click it 3x to light the fire -->
              <button
                type="button"
                class="relative shrink-0 cursor-pointer rounded transition-transform duration-200 hover:scale-110 focus-visible:outline-accent/70 w-5 h-5 sm:w-6 sm:h-6"
                :aria-label="$t('vacations.poke_log')"
                @click="pokeLog"
              >
                <span
                  class="absolute inset-0 i-lucide:flame-kindling w-5 h-5 sm:w-6 sm:h-6 text-orange-400 transition-opacity duration-400"
                  :class="fireVisible ? 'opacity-100' : 'opacity-0'"
                />
                <span
                  class="absolute inset-0 i-lucide:tent w-5 h-5 sm:w-6 sm:h-6 transition-colors duration-400"
                  :class="fireVisible ? 'text-amber-700' : ''"
                />
              </button>
              <span
                v-for="(icon, i) in icons"
                :key="`${n}-${i}`"
                class="shrink-0 w-5 h-5 sm:w-6 sm:h-6 opacity-40"
                :class="icon"
                aria-hidden="true"
              />
            </template>
          </div>
        </div>

        <!-- See you soon -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('vacations.return.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-6">
            <i18n-t keypath="vacations.return.p1" tag="span" scope="global">
              <template #social>
                <LinkBase class="font-sans" to="https://social.npmx.dev">
                  {{ $t('vacations.return.social_link') }}
                </LinkBase>
              </template>
            </i18n-t>
          </p>

          <!-- Add to calendar button -->
          <ButtonBase classicon="i-lucide:calendar" @click="downloadIcs">
            {{ $t('vacations.return.add_to_calendar') }}
          </ButtonBase>
        </div>

        <div
          v-if="stats"
          class="grid grid-cols-3 justify-center gap-4 sm:gap-8 mb-8 py-8 border-y border-border/50"
        >
          <div class="space-y-1 text-center">
            <div class="font-mono text-2xl sm:text-3xl font-bold text-fg">
              {{ formatStat(stats.contributors) }}
            </div>
            <div class="text-xs sm:text-sm text-fg-subtle uppercase tracking-wider">
              {{ $t('vacations.stats.contributors') }}
            </div>
          </div>
          <div class="space-y-1 text-center">
            <div class="font-mono text-2xl sm:text-3xl font-bold text-fg">
              {{ formatStat(stats.commits) }}
            </div>
            <div class="text-xs sm:text-sm text-fg-subtle uppercase tracking-wider">
              {{ $t('vacations.stats.commits') }}
            </div>
          </div>
          <div class="space-y-1 text-center">
            <div class="font-mono text-2xl sm:text-3xl font-bold text-fg">
              {{ formatStat(stats.pullRequests) }}
            </div>
            <div class="text-xs sm:text-sm text-fg-subtle uppercase tracking-wider">
              {{ $t('vacations.stats.pr') }}
            </div>
          </div>
        </div>
      </section>
    </article>
  </main>
</template>

<style scoped>
.animate-bounce-slow {
  animation: bounce 3s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-bounce-slow {
    animation: none;
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(-5%);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}
</style>
