<script setup lang="ts">
import type { ModuleReplacement } from 'module-replacements'

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

const docUrl = computed(() => {
  if (props.replacement.type !== 'documented' || !props.replacement.docPath) return null
  return `https://e18e.dev/docs/replacements/${props.replacement.docPath}.html`
})
</script>

<template>
  <div
    class="flex items-start gap-2 px-3 py-2 rounded-lg text-sm"
    :class="
      variant === 'nodep'
        ? 'bg-amber-500/10 border border-amber-600/30 text-amber-700 dark:text-amber-400'
        : 'bg-blue-500/10 border border-blue-600/30 text-blue-700 dark:text-blue-400'
    "
  >
    <span
      class="w-4 h-4 flex-shrink-0 mt-0.5"
      :class="variant === 'nodep' ? 'i-carbon:idea' : 'i-carbon:information'"
    />
    <div class="min-w-0 flex-1">
      <p class="font-medium">{{ packageName }}: {{ $t('package.replacement.title') }}</p>
      <p class="text-xs mt-0.5 opacity-80">
        <template v-if="replacement.type === 'native'">
          {{
            $t('package.replacement.native', {
              replacement: replacement.replacement,
              nodeVersion: replacement.nodeVersion,
            })
          }}
        </template>
        <template v-else-if="replacement.type === 'simple'">
          {{
            $t('package.replacement.simple', {
              replacement: replacement.replacement,
              community: $t('package.replacement.community'),
            })
          }}
        </template>
        <template v-else-if="replacement.type === 'documented'">
          {{
            $t('package.replacement.documented', {
              community: $t('package.replacement.community'),
            })
          }}
        </template>
      </p>
    </div>

    <!-- No dependency action button -->
    <ButtonBase
      v-if="variant === 'nodep' && showAction !== false"
      size="small"
      :aria-label="$t('compare.no_dependency.add_column')"
      @click="emit('addNoDep')"
    >
      {{ $t('package.replacement.consider_no_dep') }}
    </ButtonBase>

    <!-- Info link -->
    <LinkBase v-else-if="docUrl" :to="docUrl" variant="button-secondary" size="small">
      {{ $t('package.replacement.learn_more') }}
    </LinkBase>
  </div>
</template>
