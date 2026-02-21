<script setup lang="ts">
import type { ReleaseData } from '~~/shared/types/changelog'
import { useDateFormat } from '#imports'

const { release } = defineProps<{
  release: ReleaseData
}>()
const formattedDate = useDateFormat(() => release.publishedAt, 'YYYY-MM-DD', {})

const cardId = computed(() => (release.publishedAt ? `date-${formattedDate.value}` : undefined))

const navId = computed(() => `releaae-${encodeURIComponent(release.title)}`)

function navigateToTitle() {
  navigateTo(`#${navId.value}`)
}
</script>
<template>
  <section class="border border-border rounded-lg p-4 sm:p-6">
    <div class="flex justify-between" :id="cardId">
      <h2 class="text-1xl sm:text-2xl font-medium min-w-0 break-words py-2" :id="navId">
        <a
          class="hover:decoration-accent hover:text-accent focus-visible:decoration-accent focus-visible:text-accent transition-colors duration-200"
          :class="$style.linkTitle"
          :href="`#${navId}`"
          @click.prevent="navigateToTitle()"
        >
          {{ release.title }}
        </a>
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

<style module>
.linkTitle::after {
  content: '__';
  @apply inline i-lucide:link rtl-flip ms-1 opacity-0;
}

.linkTitle:hover:after {
  @apply opacity-100;
}
</style>
