<script setup lang="ts">
import type { PublishSecurityDowngrade } from '~/utils/publish-security'

defineProps<{
  downgrade: PublishSecurityDowngrade | null
  fallbackInstallText?: string | null
}>()
</script>

<template>
  <div
    v-if="downgrade"
    role="alert"
    class="mb-4 rounded-lg border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-400"
  >
    <h3 class="m-0 flex items-center gap-2 font-mono text-sm font-medium">
      <span class="i-lucide:circle-alert w-4 h-4 shrink-0" aria-hidden="true" />
      {{ $t('package.security_downgrade.title') }}
    </h3>
    <p class="mt-2 mb-0 text-sm">
      <i18n-t
        v-if="
          downgrade.downgradedTrustLevel === 'none' && downgrade.trustedTrustLevel === 'provenance'
        "
        keypath="package.security_downgrade.description_to_none_provenance"
        tag="span"
        scope="global"
      >
        <template #provenance>
          <a
            href="https://docs.npmjs.com/generating-provenance-statements"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 rounded-sm underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg focus-visible:decoration-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
            >{{ $t('package.security_downgrade.provenance_link_text')
            }}<span class="i-lucide:external-link w-3 h-3" aria-hidden="true"
          /></a>
        </template>
      </i18n-t>
      <i18n-t
        v-else-if="
          downgrade.downgradedTrustLevel === 'none' &&
          downgrade.trustedTrustLevel === 'trustedPublisher'
        "
        keypath="package.security_downgrade.description_to_none_trustedPublisher"
        tag="span"
        scope="global"
      >
        <template #trustedPublishing>
          <a
            href="https://docs.npmjs.com/trusted-publishers"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 rounded-sm underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg focus-visible:decoration-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
            >{{ $t('package.security_downgrade.trusted_publishing_link_text')
            }}<span class="i-lucide:external-link w-3 h-3" aria-hidden="true"
          /></a>
        </template>
      </i18n-t>
      <i18n-t
        v-else-if="
          downgrade.downgradedTrustLevel === 'provenance' &&
          downgrade.trustedTrustLevel === 'trustedPublisher'
        "
        keypath="package.security_downgrade.description_to_provenance_trustedPublisher"
        tag="span"
        scope="global"
      >
        <template #provenance>
          <a
            href="https://docs.npmjs.com/generating-provenance-statements"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 rounded-sm underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg focus-visible:decoration-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
            >{{ $t('package.security_downgrade.provenance_link_text')
            }}<span class="i-lucide:external-link w-3 h-3" aria-hidden="true"
          /></a>
        </template>
        <template #trustedPublishing>
          <a
            href="https://docs.npmjs.com/trusted-publishers"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 rounded-sm underline underline-offset-4 decoration-amber-600/60 dark:decoration-amber-400/50 hover:decoration-fg focus-visible:decoration-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
            >{{ $t('package.security_downgrade.trusted_publishing_link_text')
            }}<span class="i-lucide:external-link w-3 h-3" aria-hidden="true"
          /></a>
        </template>
      </i18n-t>
      {{ ' ' }}
      <template v-if="fallbackInstallText">
        {{ fallbackInstallText }}
      </template>
    </p>
  </div>
</template>
