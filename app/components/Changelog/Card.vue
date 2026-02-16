<script setup lang="ts">
import type { ReleaseData } from '~~/shared/types/changelog'
import { useDateFormat } from '#imports'

const { release } = defineProps<{
  release: ReleaseData
}>()
const formattedDate = useDateFormat(() => release.publishedAt, 'YYYY-MM-DD', {})

const cardId = computed(() => (release.publishedAt ? `date-${formattedDate.value}` : undefined))

const navId = computed(() => `releaae-${encodeURIComponent(release.title)}`)
</script>
<template>
  <section class="border border-border rounded-lg p-4 sm:p-6">
    <div class="flex justify-between" :id="cardId">
      <h2 class="text-1xl sm:text-2xl font-medium min-w-0 break-words py-2" :id="navId">
        {{ release.title }}
      </h2>
      <ReadmeTocDropdown
        v-if="release?.toc && release.toc.length > 1"
        :toc="release.toc"
        class="justify-self-end"
      />
      <!-- :active-id="activeTocId" -->
    </div>
    <Readme v-if="release.html" :html="release.html"></Readme>
  </section>
</template>

<!--     class="group bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 transition-[border-color,background-color] duration-200 hover:(border-border-hover bg-bg-muted) cursor-pointer relative focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-bg focus-within:ring-offset-2 focus-within:ring-fg/50 focus-within:bg-bg-muted focus-within:border-border-hover" -->
