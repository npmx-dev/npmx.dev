<script setup lang="ts">
import type { ModuleReplacement, KnownUrl } from 'module-replacements'

const props = defineProps<{
  replacement: ModuleReplacement
}>()

const resolveUrl = (url?: KnownUrl) => {
  if (!url) return null
  if (typeof url === 'string') return url

  switch (url.type) {
    case 'mdn':
      return `https://developer.mozilla.org/en-US/docs/${url.id}`
    case 'node':
      return `https://nodejs.org/${url.id}`
    case 'e18e':
      return `https://e18e.dev/docs/replacements/${url.id}`
    default:
      return null
  }
}

const externalUrl = computed(() => resolveUrl(props.replacement.url))

const nodeVersion = computed(() => {
  const nodeEngine = props.replacement.engines?.find(e => e.engine === 'nodejs')
  return nodeEngine?.minVersion || null
})
</script>

<template>
  <div
    class="border border-amber-600/40 bg-amber-500/10 rounded-lg px-3 py-2 text-base text-amber-800 dark:text-amber-400"
  >
    <h2 class="font-medium mb-1 flex items-center gap-2">
      <span class="i-lucide:lightbulb w-4 h-4" aria-hidden="true" />
      {{ $t('package.replacement.title') }}
    </h2>
    <i18n-t
      v-if="replacement.type === 'native'"
      keypath="package.replacement.native"
      scope="global"
    >
      <template #replacement>
        <code v-if="replacement.nodeFeatureId?.moduleName">
          {{ replacement.nodeFeatureId.moduleName }}
        </code>
        <code v-else-if="replacement.description">
          {{ replacement.description }}
        </code>
        <span v-else>{{ replacement.id }}</span>
      </template>
      <template #nodeVersion>
        {{ nodeVersion || 'unknown' }}
      </template>
    </i18n-t>
    <div v-else-if="replacement.type === 'simple'" class="block">
      <div class="mb-2">{{ replacement.description }}</div>
      <div v-if="replacement.example">
        <strong class="block mb-1.5">Example:</strong>
        <pre
          class="bg-amber-800/10 dark:bg-amber-950/30 p-2 rounded border border-amber-700/20 overflow-x-auto text-xs font-mono leading-relaxed"
        ><code>{{ replacement.example }}</code></pre>
      </div>
    </div>
    <i18n-t
      v-else-if="replacement.type === 'documented'"
      keypath="package.replacement.documented"
      scope="global"
    >
      <template #replacement>
        <code>{{ replacement.replacementModule }}</code>
      </template>
      <template #community>
        <a
          href="https://e18e.dev/docs/replacements/"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 ms-1 underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg transition-colors"
        >
          {{ $t('package.replacement.community') }}
          <span class="i-lucide:external-link w-3 h-3" aria-hidden="true" />
        </a>
      </template>
    </i18n-t>
    <template v-else-if="replacement.type === 'removal'">
      {{ replacement.description }}
    </template>
    <template v-else>
      {{ $t('package.replacement.none') }}
    </template>
    <a
      v-if="externalUrl"
      :href="externalUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-1 ms-1 underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg transition-colors"
    >
      {{ $t('package.replacement.learn_more') }}
      <span class="i-lucide:external-link w-3 h-3" aria-hidden="true" />
    </a>
  </div>
</template>
