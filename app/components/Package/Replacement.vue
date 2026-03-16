<script setup lang="ts">
import type { ModuleReplacement } from 'module-replacements'
import { resolveReplacementUrl } from '~/utils/resolve-replacement-url'

const props = defineProps<{
  mapping: ModuleReplacementMapping
  replacement: ModuleReplacement
}>()

const externalUrl = computed(() =>
  resolveReplacementUrl(props.mapping.url ?? props.replacement.url),
)

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
      v-if="nodeVersion && replacement.type === 'native'"
      keypath="package.replacement.native"
      scope="global"
    >
      <template #replacement>
        <code v-if="replacement.description">
          {{ replacement.description }}
        </code>
        <span v-else>{{ replacement.id }}</span>
      </template>
      <template #nodeVersion>
        {{ nodeVersion }}
      </template>
    </i18n-t>
    <i18n-t
      v-else-if="replacement.type === 'native'"
      keypath="package.replacement.native_no_version"
      scope="global"
    >
      <template #replacement>
        <code v-if="replacement.description">
          {{ replacement.description }}
        </code>
        <span v-else>{{ replacement.id }}</span>
      </template>
    </i18n-t>
    <div v-else-if="replacement.type === 'simple'" class="block">
      <div class="mb-2">{{ replacement.description }}</div>
      <div v-if="replacement.example">
        <strong class="block mb-1.5">{{ $t('package.replacement.example') }}</strong>
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
