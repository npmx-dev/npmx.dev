<script setup lang="ts">
import { parseLicenseExpression } from '#shared/utils/spdx'

import { useLicenseChanges } from '~/composables/useLicenseChanges'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  license: string
  packageName?: string
}>()

const { t } = useI18n()

const tokens = computed(() => parseLicenseExpression(props.license))
const licenseChanges = useLicenseChanges(() => props.packageName)

const changes = computed(() => licenseChanges.data.value?.changes ?? [])

const licenseChangeText = computed(() =>
  changes.value
    .map(item =>
      t('package.versions.license_change_item', {
        from: item.from,
        to: item.to,
        version: item.version,
      }),
    )
    .join('; '),
)

const hasAnyValidLicense = computed(() => tokens.value.some(t => t.type === 'license' && t.url))
</script>

<template>
  <span class="inline-flex items-baseline gap-x-1.5 flex-wrap gap-y-0.5">
    <template v-for="(token, i) in tokens" :key="i">
      <a
        v-if="token.type === 'license' && token.url"
        :href="token.url"
        target="_blank"
        rel="noopener noreferrer"
        class="link-subtle"
        :title="$t('package.license.view_spdx')"
      >
        {{ token.value }}
      </a>
      <span v-else-if="token.type === 'license'">{{ token.value }}</span>
      <span v-else-if="token.type === 'operator'" class="text-4xs">{{ token.value }}</span>
    </template>
    <span
      v-if="hasAnyValidLicense"
      class="i-lucide:scale w-3.5 h-3.5 text-fg-subtle flex-shrink-0 self-center"
      aria-hidden="true"
    />
  </span>
  <div
    v-if="changes.length > 0"
    class="border border-amber-600/40 bg-amber-500/10 rounded-lg inline-flex justify-start items-center mt-1 gap-x-1 py-[2px] px-[3px]"
  >
    <p class="text-md text-amber-800 dark:text-amber-400">
      {{ $t("package.versions.license_change_warning") }}
    </p>
    <TooltipApp interactive position="top">
      <span
        tabindex="0"
        class="block cursor-help shrink-0 -m-2 p-2 -me-1 focus-visible:outline-2 focus-visible:outline-accent/70 rounded"
      >
        <span
          class="block i-lucide:info w-3.5 h-3.5 text-fg-subtle"
          role="img"
          :aria-label="$t('package.versions.license_change_help')"
        />
      </span>
      <template #content>
        <p class="text-xs text-fg-muted">
          <i18n-t keypath="package.versions.changed_license" tag="span">
            <template #license_change>{{ licenseChangeText }}</template>
          </i18n-t>
        </p>
      </template>
    </TooltipApp>
  </div>
</template>
