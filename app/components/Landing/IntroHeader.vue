<script setup lang="ts">
import { ACTIVE_NOODLES, PERMANENT_NOODLES, type Noodle } from '../Noodle'

const { env } = useAppConfig().buildInfo

const activeNoodlesData = ACTIVE_NOODLES.map(noodle => ({
  key: noodle.key,
  date: noodle.date,
  dateTo: noodle.dateTo,
  timezone: noodle.timezone,
  tagline: noodle.tagline,
}))

const permanentNoodlesData = PERMANENT_NOODLES.map(noodle => ({
  key: noodle.key,
  tagline: noodle.tagline,
}))

onPrehydrate(el => {
  const tagline = el.querySelector<HTMLElement>('#intro-header-tagline')
  const defaultLogo = el.querySelector<HTMLElement>('#intro-header-noodle-default')

  if (!tagline || !defaultLogo) return

  let permanentNoodles
  try {
    permanentNoodles = JSON.parse(el.dataset.permanentNoodles as string) as Noodle[]
  } catch {
    return
  }
  const activePermanentNoodle = permanentNoodles?.find(noodle =>
    new URLSearchParams(window.location.search).has(noodle.key),
  )

  if (activePermanentNoodle) {
    const permanentNoodleLogo = el.querySelector<HTMLElement>(
      `#intro-header-noodle-${activePermanentNoodle.key}`,
    )

    if (!permanentNoodleLogo) return

    permanentNoodleLogo.style.display = 'block'
    defaultLogo.style.display = 'none'
    if (activePermanentNoodle.tagline === false) {
      tagline.style.display = 'none'
    }
    return
  }

  let activeNoodles
  try {
    activeNoodles = JSON.parse(el.dataset.activeNoodles as string) as Noodle[]
  } catch {
    return
  }

  const currentActiveNoodles = activeNoodles.filter(noodle => {
    const todayDate = new Date()
    const todayDateRaw = new Intl.DateTimeFormat('en-US', {
      timeZone: noodle.timezone === 'auto' ? undefined : noodle.timezone,
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }).format(todayDate)

    const noodleDateFrom = new Date(noodle.date!)
    if (!noodle.dateTo) {
      const noodleDateFromRaw = new Intl.DateTimeFormat('en-US', {
        timeZone: noodle.timezone === 'auto' ? undefined : noodle.timezone,
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      }).format(noodleDateFrom)
      return todayDateRaw === noodleDateFromRaw
    }
    const noodleDateTo = new Date(noodle.dateTo!)
    return todayDate >= noodleDateFrom && todayDate <= noodleDateTo
  })

  if (!currentActiveNoodles.length) return

  const roll = Math.floor(Math.random() * currentActiveNoodles.length)
  const selectedNoodle = currentActiveNoodles[roll]

  if (!selectedNoodle) return

  const noodleLogo = el.querySelector<HTMLElement>(`#intro-header-noodle-${selectedNoodle.key}`)

  if (!defaultLogo || !noodleLogo || !tagline) return

  defaultLogo.style.display = 'none'
  noodleLogo.style.display = 'block'
  if (selectedNoodle.tagline === false) {
    tagline.style.display = 'none'
  }
})
</script>

<template>
  <div
    :data-active-noodles="JSON.stringify(activeNoodlesData)"
    :data-permanent-noodles="JSON.stringify(permanentNoodlesData)"
  >
    <h1 class="sr-only">
      {{ $t('alt_logo') }}
    </h1>
    <div
      id="intro-header-noodle-default"
      class="relative mb-6 w-fit mx-auto motion-safe:animate-fade-in motion-safe:animate-fill-both"
      aria-hidden="true"
    >
      <AppLogo id="npmx-index-h1-logo-normal" class="w-42 h-auto sm:w-58 md:w-70" />
      <span
        id="npmx-index-h1-logo-env"
        class="text-sm sm:text-base md:text-lg transform-origin-br font-mono tracking-widest text-accent absolute -bottom-4 -inset-ie-1.5"
      >
        {{ env === 'release' ? 'alpha' : env }}
      </span>
    </div>
    <component
      v-for="noodle in PERMANENT_NOODLES"
      :key="noodle.key"
      :id="`intro-header-noodle-${noodle.key}`"
      class="hidden"
      aria-hidden="true"
      :is="noodle.logo"
    />
    <component
      v-for="noodle in ACTIVE_NOODLES"
      :key="noodle.key"
      :id="`intro-header-noodle-${noodle.key}`"
      class="hidden"
      aria-hidden="true"
      :is="noodle.logo"
    />
    <p
      id="intro-header-tagline"
      class="text-fg-muted text-lg sm:text-xl max-w-xl mb-12 lg:mb-14 motion-safe:animate-slide-up motion-safe:animate-fill-both delay-100"
    >
      {{ $t('tagline') }}
    </p>
  </div>
</template>
