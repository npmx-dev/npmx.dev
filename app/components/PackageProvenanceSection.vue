<script setup lang="ts">
import type { ProvenanceDetails } from '#shared/types'

defineProps<{
  /** Parsed provenance details from the API */
  details: ProvenanceDetails
  /** Optional: link "View on npm" to package provenance page */
  packageName?: string
  version?: string
}>()
</script>

<template>
  <section id="provenance" aria-labelledby="provenance-heading" class="scroll-mt-20">
    <h2 id="provenance-heading" class="group text-xs text-fg-subtle uppercase tracking-wider mb-3">
      <a
        href="#provenance"
        class="inline-flex items-center gap-1.5 text-fg-subtle hover:text-fg-muted transition-colors duration-200 no-underline"
      >
        {{ $t('package.provenance_section.title') }}
        <span
          class="i-carbon-link w-3 h-3 block opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          aria-hidden="true"
        />
      </a>
    </h2>

    <div class="space-y-3">
      <p class="flex items-center gap-2 text-sm text-fg m-0">
        <span
          class="i-solar-shield-check-outline w-4 h-4 shrink-0 text-emerald-500"
          aria-hidden="true"
        />
        <span>{{
          $t('package.provenance_section.built_and_signed_on', { provider: details.providerLabel })
        }}</span>
      </p>
      <a
        v-if="details.buildSummaryUrl"
        :href="details.buildSummaryUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="link text-sm font-medium block"
      >
        {{ $t('package.provenance_section.view_build_summary') }}
      </a>

      <dl class="space-y-3 m-0 mt-4">
        <div v-if="details.sourceCommitUrl" class="flex flex-col gap-0.5">
          <dt class="font-mono text-xs text-fg-muted m-0">
            {{ $t('package.provenance_section.source_commit') }}
          </dt>
          <dd class="m-0">
            <a
              :href="details.sourceCommitUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="link font-mono text-sm break-all"
            >
              {{
                details.sourceCommitSha
                  ? `${details.sourceCommitSha.slice(0, 12)}`
                  : details.sourceCommitUrl
              }}
            </a>
          </dd>
        </div>
        <div v-if="details.buildFileUrl" class="flex flex-col gap-0.5">
          <dt class="font-mono text-xs text-fg-muted m-0">
            {{ $t('package.provenance_section.build_file') }}
          </dt>
          <dd class="m-0">
            <a
              :href="details.buildFileUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="link font-mono text-sm break-all"
            >
              {{ details.buildFilePath ?? details.buildFileUrl }}
            </a>
          </dd>
        </div>
        <div v-if="details.publicLedgerUrl" class="flex flex-col gap-0.5">
          <dt class="font-mono text-xs text-fg-muted m-0">
            {{ $t('package.provenance_section.public_ledger') }}
          </dt>
          <dd class="m-0">
            <a
              :href="details.publicLedgerUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="link text-sm"
            >
              {{ $t('package.provenance_section.transparency_log_entry') }}
            </a>
          </dd>
        </div>
      </dl>
    </div>

    <p v-if="packageName && version" class="mt-4 m-0">
      <a
        :href="`https://www.npmjs.com/package/${packageName}/v/${version}#provenance`"
        target="_blank"
        rel="noopener noreferrer"
        class="link-subtle font-mono text-sm"
      >
        {{ $t('common.view_on_npm') }}
      </a>
    </p>
  </section>
</template>
