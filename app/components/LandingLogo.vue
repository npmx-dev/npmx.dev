<script setup lang="ts">
defineProps<{
  class?: string
}>()

const { env } = useAppConfig().buildInfo

onPrehydrate(el => {
  const isKawaii = new URLSearchParams(window.location.search).has('kawaii')
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const isTKawaii = date === '03/31'

  if (!isKawaii && !isTKawaii) return

  const normalLogo = el.querySelector<HTMLElement>('#npmx-index-h1-logo-normal')
  const kawaiiLogo = el.querySelector<HTMLElement>('#npmx-index-h1-logo-kawaii')
  const tkawaiiLogo = el.querySelector<HTMLElement>('#npmx-index-h1-logo-tkawaii')
  const logoEnv = el.querySelector<HTMLElement>('#npmx-index-h1-logo-env')
  const logoTagline = el.querySelector<HTMLElement>('#npmx-index-tagline')

  if (!normalLogo || !kawaiiLogo || !tkawaiiLogo || !logoEnv || !logoTagline) return

  if (isTKawaii) {
    tkawaiiLogo.style.display = 'block'
  } else {
    kawaiiLogo.style.display = 'block'
  }
  normalLogo.style.display = 'none'
  logoEnv.style.display = 'none'
  logoTagline.style.display = 'none'
})
</script>

<template>
  <div class="flex flex-col items-center justify-center">
    <h1
      dir="ltr"
      class="relative flex items-center justify-center gap-2 header-logo font-mono text-5xl sm:text-7xl md:text-8xl font-medium tracking-tight mb-6 motion-safe:animate-fade-in motion-safe:animate-fill-both"
    >
      <img
        id="npmx-index-h1-logo-kawaii"
        width="400"
        class="hidden mb-8 motion-safe:animate-fade-in motion-safe:animate-scale-in motion-safe:hover:scale-105 motion-safe:transition w-80 sm:w-100"
        src="/extra/npmx-cute.svg"
        :alt="$t('alt_logo_kawaii')"
        :class="class"
      />
      <img
        id="npmx-index-h1-logo-tkawaii"
        width="400"
        class="hidden mb-8 motion-safe:animate-fade-in motion-safe:animate-scale-in motion-safe:hover:scale-105 motion-safe:transition w-80 sm:w-100"
        src="/extra/npmx-cute-transgender.svg"
        :alt="$t('alt_logo_kawaii')"
        :class="class"
      />
      <AppLogo id="npmx-index-h1-logo-normal" :class="class" />
      <span
        id="npmx-index-h1-logo-env"
        aria-hidden="true"
        class="text-sm sm:text-base md:text-lg transform-origin-br font-mono tracking-widest text-accent absolute -bottom-4 -inset-ie-1.5"
      >
        {{ env === 'release' ? 'alpha' : env }}
      </span>
    </h1>
    <p
      id="npmx-index-tagline"
      class="text-fg-muted text-lg sm:text-xl max-w-xl mb-12 lg:mb-14 motion-safe:animate-slide-up motion-safe:animate-fill-both delay-100"
    >
      {{ $t('tagline') }}
    </p>
  </div>
</template>
