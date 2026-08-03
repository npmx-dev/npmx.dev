<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import type { Component } from 'vue'
import { loadNoodleLogo } from '~/noodles/logos'

const { env } = useAppConfig().buildInfo

// Decided on the server and embedded in the SSR payload; the client only loads
// the single logo it needs.
const active = useActiveNoodle()
const activeLogo = shallowRef<Component | null>(null)
const hideTagline = ref(false)

onMounted(async () => {
  const noodle = active.value
  if (!noodle) return

  hideTagline.value = noodle.tagline === false
  const logoComponent = await loadNoodleLogo(noodle.key)
  if (logoComponent) activeLogo.value = logoComponent
})
</script>

<template>
  <div>
    <h1 class="sr-only">
      {{ $t('alt_logo') }}
    </h1>
    <div
      v-show="!activeLogo"
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
      :is="activeLogo"
      v-if="activeLogo"
      id="intro-header-noodle-active"
      class="mb-6 w-fit mx-auto motion-safe:animate-fade-in motion-safe:animate-fill-both"
      aria-hidden="true"
    />
    <p
      id="intro-header-tagline"
      v-show="!hideTagline"
      class="text-fg-muted text-lg sm:text-xl mb-12 lg:mb-14 motion-safe:animate-slide-up motion-safe:animate-fill-both delay-100"
    >
      {{ $t('tagline') }}
    </p>
  </div>
</template>
