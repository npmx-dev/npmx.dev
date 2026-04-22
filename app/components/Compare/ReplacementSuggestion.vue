<script setup lang="ts">
import type { ModuleReplacement } from 'module-replacements'
import { resolveDocUrl } from 'module-replacements'
import { getReplacementDescription, getReplacementNodeVersion } from '~/utils/module-replacements'

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

const docUrl = computed(() => resolveDocUrl(props.replacement.url))

const nodeVersion = computed(() => getReplacementNodeVersion(props.replacement))

const replacementDescription = useMarkdown(() => ({
  text: getReplacementDescription(props.replacement),
}))
</script>

<template>
  <div
    class="flex items-start gap-2 px-3 py-2 rounded-lg text-sm"
    :class="
      variant === 'nodep'
        ? 'bg-amber-500/10 border border-amber-600/30 text-amber-800 dark:text-amber-400'
        : 'bg-blue-500/10 border border-blue-600/30 text-blue-700 dark:text-blue-400'
    "
    data-testid="replacement-suggestion-card"
  >
    <span
      class="w-4 h-4 flex-shrink-0 mt-0.5"
      :class="variant === 'nodep' ? 'i-lucide:lightbulb' : 'i-lucide:info'"
    />
    <div class="min-w-0 flex-1">
      <p class="font-medium">{{ packageName }}: {{ $t('package.replacement.title') }}</p>
      <p class="text-xs mt-0.5 opacity-80">
        <i18n-t
          v-if="nodeVersion && replacement.type === 'native'"
          keypath="package.replacement.native"
          scope="global"
        >
          <template #replacement>
            <span v-if="replacementDescription" v-html="replacementDescription" />
            <span v-else
              ><code>{{ replacement.id }}</code></span
            >
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
            <span v-if="replacementDescription" v-html="replacementDescription" />
            <span v-else
              ><code>{{ replacement.id }}</code></span
            >
          </template>
        </i18n-t>
        <template v-else-if="replacement.type === 'simple'">
          <i18n-t keypath="package.replacement.simple">
            <template #replacement><span v-html="replacementDescription" /></template>
            <template #community>{{ $t('package.replacement.community') }}</template>
          </i18n-t>
        </template>
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
          <span v-html="replacementDescription" />
        </template>
      </p>
    </div>

    <ButtonBase
      v-if="variant === 'nodep' && showAction !== false"
      size="sm"
      :aria-label="$t('compare.no_dependency.add_column')"
      @click="emit('addNoDep')"
    >
      {{ $t('package.replacement.consider_no_dep') }}
    </ButtonBase>

    <!-- Info link -->
    <LinkBase v-else-if="docUrl" :to="docUrl" variant="button-secondary" size="sm">
      {{ $t('package.replacement.learn_more') }}
    </LinkBase>
  </div>
</template>
