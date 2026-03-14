<script setup lang="ts">
import type { ModuleReplacement, KnownUrl } from 'module-replacements'

const props = defineProps<{
  packageName: string
  replacement: ModuleReplacement
  /** Whether this suggestion should show the "no dep" action (native/simple) or just info (documented) */
  variant: 'nodep' | 'info'
  /** Whether to show the action button (defaults to true) */
  showAction?: boolean
}>()

const emit = defineEmits<{
  addNoDep: []
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

const docUrl = computed(() => resolveUrl(props.replacement.url))

const nodeVersion = computed(() => {
  const nodeEngine = props.replacement.engines?.find(e => e.engine === 'nodejs')
  return nodeEngine?.minVersion || null
})
</script>

<template>
  <div
    class="flex items-start gap-2 px-3 py-2 rounded-lg text-sm"
    :class="
      variant === 'nodep'
        ? 'bg-amber-500/10 border border-amber-600/30 text-amber-800 dark:text-amber-400'
        : 'bg-blue-500/10 border border-blue-600/30 text-blue-700 dark:text-blue-400'
    "
  >
    <span
      class="w-4 h-4 flex-shrink-0 mt-0.5"
      :class="variant === 'nodep' ? 'i-lucide:lightbulb' : 'i-lucide:info'"
    />
    <div class="min-w-0 flex-1">
      <p class="font-medium">{{ packageName }}: {{ $t('package.replacement.title') }}</p>
      <p class="text-xs mt-0.5 opacity-80">
        <template v-if="replacement.type === 'native'">
          {{
            $t('package.replacement.native', {
              replacement:
                replacement.nodeFeatureId?.moduleName || replacement.description || replacement.id,
              nodeVersion: nodeVersion || 'unknown',
            })
          }}
        </template>
        <template v-else-if="replacement.type === 'simple'">
          {{
            $t('package.replacement.simple', {
              replacement: replacement.description,
              community: $t('package.replacement.community'),
            })
          }}
        </template>
        <template v-else-if="replacement.type === 'documented'">
          {{
            $t('package.replacement.documented', {
              replacement: replacement.replacementModule,
              community: $t('package.replacement.community'),
            })
          }}
        </template>
        <template v-else-if="replacement.type === 'removal'">
          {{ replacement.description }}
        </template>
      </p>
    </div>

    <ButtonBase
      v-if="variant === 'nodep' && showAction !== false"
      size="small"
      :aria-label="$t('compare.no_dependency.add_column')"
      @click="emit('addNoDep')"
    >
      {{ $t('package.replacement.consider_no_dep') }}
    </ButtonBase>

    <LinkBase
      v-else-if="docUrl"
      :to="docUrl"
      variant="button-secondary"
      size="small"
      target="_blank"
    >
      {{ $t('package.replacement.learn_more') }}
    </LinkBase>
  </div>
</template>
