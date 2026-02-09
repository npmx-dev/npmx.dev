<script setup lang="ts">
import type { I18nLocaleStatus } from '#shared/types'

const props = defineProps<{
  status: I18nLocaleStatus
}>()

// Show first N missing keys by default
const INITIAL_SHOW_COUNT = 5
const showAll = shallowRef(false)

const missingKeysToShow = computed(() => {
  if (showAll.value || props.status.missingKeys.length <= INITIAL_SHOW_COUNT) {
    return props.status.missingKeys
  }
  return props.status.missingKeys.slice(0, INITIAL_SHOW_COUNT)
})

const hasMoreKeys = computed(
  () => props.status.missingKeys.length > INITIAL_SHOW_COUNT && !showAll.value,
)

const remainingCount = computed(() => props.status.missingKeys.length - INITIAL_SHOW_COUNT)

// Generate a GitHub URL that pre-fills the edit with guidance
const contributionGuideUrl =
  'https://github.com/npmx-dev/npmx.dev/blob/main/CONTRIBUTING.md#localization-i18n'

// Copy missing keys as JSON template to clipboard
const { copy, copied } = useClipboard()

const numberFormatter = useNumberFormatter()
const percentageFormatter = useNumberFormatter({ style: 'percent' })

function copyMissingKeysTemplate() {
  // Create a template showing what needs to be added
  const template = props.status.missingKeys.map(key => `  "${key}": ""`).join(',\n')

  const fullTemplate = `// Missing translations for ${props.status.label} (${props.status.lang})
// Add these keys to: i18n/locales/${props.status.lang}.json

${template}`

  copy(fullTemplate)
}
</script>

<template>
  <div class="space-y-3">
    <!-- Progress section -->
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-xs text-fg-muted">
        <span>{{ $t('settings.translation_progress') }}</span>
        <span class="tabular-nums"
          >{{ numberFormatter.format(status.completedKeys) }}/{{
            numberFormatter.format(status.totalKeys)
          }}
          ({{ percentageFormatter.format(status.percentComplete / 100) }})</span
        >
      </div>
      <div class="h-1.5 bg-bg rounded-full overflow-hidden">
        <div
          class="h-full bg-accent transition-all duration-300 motion-reduce:transition-none"
          :style="{ width: `${status.percentComplete}%` }"
        />
      </div>
    </div>

    <!-- Missing keys section -->
    <div v-if="status.missingKeys.length > 0" class="space-y-2">
      <div class="flex items-center justify-between">
        <h4 class="text-xs text-fg-muted font-medium">
          {{
            $t(
              'i18n.missing_keys',
              { count: numberFormatter.format(status.missingKeys.length) },
              status.missingKeys.length,
            )
          }}
        </h4>
        <button
          type="button"
          class="text-xs text-accent hover:underline rounded focus-visible:outline-accent/70"
          @click="copyMissingKeysTemplate"
        >
          {{ copied ? $t('common.copied') : $t('i18n.copy_keys') }}
        </button>
      </div>

      <ul class="space-y-1 text-xs font-mono bg-bg rounded-md p-2 max-h-32 overflow-y-auto">
        <li v-for="key in missingKeysToShow" :key="key" class="text-fg-muted truncate" :title="key">
          {{ key }}
        </li>
      </ul>

      <button
        v-if="hasMoreKeys"
        type="button"
        class="text-xs text-fg-muted hover:text-fg rounded focus-visible:outline-accent/70"
        @click="showAll = true"
      >
        {{
          $t(
            'i18n.show_more_keys',
            { count: numberFormatter.format(remainingCount) },
            remainingCount,
          )
        }}
      </button>
    </div>

    <!-- Contribution guidance -->
    <div class="pt-2 border-t border-border space-y-2">
      <p class="text-xs text-fg-muted">
        {{ $t('i18n.contribute_hint') }}
      </p>

      <div class="flex flex-wrap gap-2">
        <a
          :href="status.githubEditUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-bg hover:bg-bg-subtle border border-border rounded-md transition-colors focus-visible:outline-accent/70"
        >
          <span class="i-carbon-edit w-3.5 h-3.5" aria-hidden="true" />
          {{ $t('i18n.edit_on_github') }}
        </a>

        <a
          :href="contributionGuideUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-fg-muted hover:text-fg rounded transition-colors focus-visible:outline-accent/70"
        >
          <span class="i-carbon-document w-3.5 h-3.5" aria-hidden="true" />
          {{ $t('i18n.view_guide') }}
        </a>
      </div>
    </div>
  </div>
</template>
