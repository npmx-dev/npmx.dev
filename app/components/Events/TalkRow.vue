<script setup lang="ts">
import type { Talk } from '~/types/events'

const { talk } = defineProps<{ talk: Talk }>()

const speakerLabel = computed(() => talk.speakers.map(s => s.name).join(', '))
</script>

<template>
  <div class="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
    <div class="min-w-0">
      <h4 class="font-mono text-fg leading-tight">{{ talk.title }}</h4>
      <p v-if="talk.abstract" class="mt-1 text-sm text-fg-subtle">{{ talk.abstract }}</p>
      <p v-if="speakerLabel" class="mt-1 font-mono text-xs text-fg-muted">{{ speakerLabel }}</p>
    </div>

    <div class="flex flex-shrink-0 items-center gap-4 font-mono text-sm">
      <LinkBase
        v-if="talk.watchUrl"
        :to="talk.watchUrl"
        variant="link"
        noUnderline
        class="inline-flex items-center gap-1 text-fg-muted hover:text-accent"
      >
        <span class="i-lucide:play w-4 h-4" aria-hidden="true" />
        {{ $t('events.watch') }}
      </LinkBase>
      <LinkBase
        v-if="talk.slidesUrl"
        :to="talk.slidesUrl"
        variant="link"
        noUnderline
        class="inline-flex items-center gap-1 text-fg-muted hover:text-accent"
      >
        <span class="i-lucide:presentation w-4 h-4" aria-hidden="true" />
        {{ $t('events.slides') }}
      </LinkBase>
      <LinkBase
        v-if="talk.pdfUrl"
        :to="talk.pdfUrl"
        variant="link"
        noUnderline
        class="inline-flex items-center gap-1 text-fg-muted hover:text-accent"
      >
        <span class="i-lucide:download w-4 h-4" aria-hidden="true" />
        {{ $t('events.pdf') }}
      </LinkBase>
    </div>
  </div>
</template>
