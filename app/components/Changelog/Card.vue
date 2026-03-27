<script setup lang="ts">
import type { ReleaseData } from '~~/shared/types/changelog'
import { slugify } from '~~/shared/utils/html'

const { release } = defineProps<{
  release: ReleaseData
}>()
const formattedDate = computed(() => {
  if (!release.publishedAt) {
    return
  }
  return new Date(release.publishedAt).toISOString().split('T')[0]
})

const cardId = computed(() => (formattedDate.value ? `date-${formattedDate.value}` : undefined))

const navId = computed(() => `release-${slugify(release.title)}`)

function navigateToTitle() {
  navigateTo(`#${navId.value}`)
}
</script>
<template>
  <section
    class="border border-border rounded-lg p-4 pt-2 sm:p-6 sm:pt-4 scroll-mt-18"
    :id="cardId"
  >
    <div
      class="flex gap-2 items-center sticky z-3 text-2xl p-2 border-border bg-bg top-[--combined-header-height]"
    >
      <h2
        class="text-1xl sm:text-2xl font-medium min-w-0 break-words py-2 scroll-mt-20"
        :id="navId"
      >
        <a
          class="hover:decoration-accent hover:text-accent focus-visible:decoration-accent focus-visible:text-accent transition-colors duration-200"
          :class="$style.linkTitle"
          :href="`#${navId}`"
          @click.prevent="navigateToTitle()"
        >
          {{ release.title }}
        </a>
      </h2>
      <TagStatic v-if="release.prerelease" variant="default" class="h-unset">
        {{ $t('changelog.pre_release') }}
      </TagStatic>
      <TagStatic v-if="release.draft" variant="default" class="h-unset">
        {{ $t('changelog.draft') }}
      </TagStatic>
      <div class="flex-1" aria-hidden="true"></div>
      <ReadmeTocDropdown
        v-if="release?.toc && release.toc.length > 1"
        :toc="release.toc"
        class="ms-auto"
      />
      <!-- :active-id="activeTocId" -->
    </div>
    <DateTime
      v-if="release.publishedAt"
      :datetime="release.publishedAt"
      date-style="medium"
      class="mb-2 block"
    />
    <Readme v-if="release.html" :html="release.html"></Readme>
  </section>
</template>

<style module>
.linkTitle::after {
  content: '__';
  @apply inline i-lucide:link rtl-flip ms-1 opacity-0;
  font-size: 0.75em;
}

.linkTitle:hover::after {
  @apply opacity-100;
}
</style>
