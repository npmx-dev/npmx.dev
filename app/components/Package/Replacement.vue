<script setup lang="ts">
import type { ModuleReplacement } from 'module-replacements'

const props = defineProps<{
  replacements: ModuleReplacement
}>()

const mdnUrl = computed(() => {
  if (props.replacements.type !== 'native' || !props.replacements.mdnPath) return null
  return `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/${props.replacements.mdnPath}`
})

const docPath = computed(() => {
  if (props.replacements.type !== 'documented' || !props.replacements.docPath) return null
  return `https://e18e.dev/docs/replacements/${props.replacements.docPath}.html`
})
</script>

<template>
  <div
    class="border border-amber-600/40 bg-amber-500/10 rounded-lg px-3 py-2 text-base text-amber-800 dark:text-amber-400"
  >
    <h2 class="font-medium mb-1 flex items-center gap-2">
      <span class="i-lucide:lightbulb w-4 h-4" aria-hidden="true" />
      {{ $t('package.replacements.title') }}
    </h2>
    <p class="text-sm m-0">
      <i18n-t
        v-if="replacements.type === 'native'"
        keypath="package.replacements.native"
        scope="global"
      >
        <template #replacements>
          {{ replacements.replacements }}
        </template>
        <template #nodeVersion>
          {{ replacements.nodeVersion }}
        </template>
      </i18n-t>
      <i18n-t
        v-else-if="replacements.type === 'simple'"
        keypath="package.replacements.simple"
        scope="global"
      >
        <template #community>
          <a
            href="https://e18e.dev/docs/replacements/"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 ms-1 underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg transition-colors"
          >
            {{ $t('package.replacements.community') }}
            <span class="i-lucide:external-link w-3 h-3" aria-hidden="true" />
          </a>
        </template>
        <template #replacements>
          {{ replacements.replacements }}
        </template>
      </i18n-t>
      <i18n-t
        v-else-if="replacements.type === 'documented'"
        keypath="package.replacements.documented"
        scope="global"
      >
        <template #community>
          <a
            href="https://e18e.dev/docs/replacements/"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 ms-1 underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg transition-colors"
          >
            {{ $t('package.replacements.community') }}
            <span class="i-lucide:external-link w-3 h-3" aria-hidden="true" />
          </a>
        </template>
      </i18n-t>
      <template v-else>
        {{ $t('package.replacements.none') }}
      </template>
      <a
        v-if="mdnUrl"
        :href="mdnUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 ms-1 underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg transition-colors"
      >
        {{ $t('package.replacements.mdn') }}
        <span class="i-lucide:external-link w-3 h-3" aria-hidden="true" />
      </a>
      <a
        v-if="docPath"
        :href="docPath"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 ms-1 underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg transition-colors"
      >
        {{ $t('package.replacements.learn_more') }}
        <span class="i-lucide:external-link w-3 h-3" aria-hidden="true" />
      </a>
    </p>
  </div>
</template>
