<script setup lang="ts">
import type { ModuleReplacement } from 'module-replacements'

const props = defineProps<{
  replacement: ModuleReplacement
}>()

const message = computed<[string, { replacement?: string; nodeVersion?: string }]>(() => {
  switch (props.replacement.type) {
    case 'native':
      return [
        'package.replacement.native',
        {
          replacement: props.replacement.replacement,
          nodeVersion: props.replacement.nodeVersion,
        },
      ]
    case 'simple':
      return [
        'package.replacement.simple',
        {
          replacement: props.replacement.replacement,
        },
      ]
    case 'documented':
      return ['package.replacement.documented', {}]
    case 'none':
      return ['package.replacement.none', {}]
  }
})

const mdnUrl = computed(() => {
  if (props.replacement.type !== 'native' || !props.replacement.mdnPath) return null
  return `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/${props.replacement.mdnPath}`
})

const docPath = computed(() => {
  if (props.replacement.type !== 'documented' || !props.replacement.docPath) return null
  return `https://github.com/es-tooling/module-replacements/blob/main/docs/modules/${props.replacement.docPath}.md`
})
</script>

<template>
  <div
    class="border border-amber-600/40 bg-amber-500/10 rounded-lg px-3 py-2 text-base text-amber-700 dark:text-amber-400"
  >
    <h2 class="font-medium mb-1 flex items-center gap-2">
      <span class="i-carbon-idea w-4 h-4" aria-hidden="true" />
      {{ $t('package.replacement.title') }}
    </h2>
    <p class="text-sm m-0">
      <i18n-t :keypath="message[0]" scope="global">
        <template #replacement>
          {{ message[1].replacement ?? '' }}
        </template>
        <template #nodeVersion>
          {{ message[1].nodeVersion ?? '' }}
        </template>
        <template #community>
          <a
            href="https://e18e.dev/docs/replacements/"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 ms-1 underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg transition-colors"
          >
            {{ $t('package.replacement.community') }}
            <span class="i-carbon-launch w-3 h-3" aria-hidden="true" />
          </a>
        </template>
      </i18n-t>
      <a
        v-if="mdnUrl"
        :href="mdnUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 ms-1 underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg transition-colors"
      >
        {{ $t('package.replacement.mdn') }}
        <span class="i-carbon-launch w-3 h-3" aria-hidden="true" />
      </a>
      <a
        v-if="docPath"
        :href="docPath"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 ms-1 underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg transition-colors"
      >
        {{ $t('package.replacement.learn_more') }}
        <span class="i-carbon-launch w-3 h-3" aria-hidden="true" />
      </a>
    </p>
  </div>
</template>
