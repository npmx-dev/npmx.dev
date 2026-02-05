<script setup lang="ts">
import type { ProvenanceDetails } from '#shared/types'

defineProps<{
  details: ProvenanceDetails
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

    <div class="space-y-3 border border-border rounded-lg p-4 sm:p-5">
      <div class="space-y-1">
        <p class="flex items-start gap-2 text-sm text-fg m-0">
          <span
            class="i-lucide-shield-check w-4 h-4 shrink-0 text-emerald-500 mt-0.5"
            aria-hidden="true"
          />
          <i18n-t keypath="package.provenance_section.built_and_signed_on" tag="span">
            <template #provider>
              <strong>{{ details.providerLabel }}</strong>
            </template>
          </i18n-t>
        </p>

        <a
          v-if="details.buildSummaryUrl"
          :href="details.buildSummaryUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="link text-sm text-fg-muted inline-flex"
        >
          {{ $t('package.provenance_section.view_build_summary') }}
        </a>
      </div>

      <dl class="m-0 mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-if="details.sourceCommitUrl" class="min-w-0 flex flex-col gap-0.5">
          <dt class="font-mono text-xs text-fg-muted m-0">
            {{ $t('package.provenance_section.source_commit') }}
          </dt>
          <dd class="m-0 min-w-0">
            <a
              :href="details.sourceCommitUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="link font-mono text-sm block min-w-0 truncate"
              :title="details.sourceCommitSha ?? details.sourceCommitUrl"
            >
              {{
                details.sourceCommitSha
                  ? `${details.sourceCommitSha.slice(0, 12)}`
                  : details.sourceCommitUrl
              }}
            </a>
          </dd>
        </div>

        <div v-if="details.buildFileUrl" class="min-w-0 flex flex-col gap-0.5">
          <dt class="font-mono text-xs text-fg-muted m-0">
            {{ $t('package.provenance_section.build_file') }}
          </dt>
          <dd class="m-0 min-w-0">
            <a
              :href="details.buildFileUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="link font-mono text-sm block min-w-0 break-words"
              :title="details.buildFilePath ?? details.buildFileUrl"
            >
              {{ details.buildFilePath ?? details.buildFileUrl }}
            </a>
          </dd>
        </div>

        <div v-if="details.publicLedgerUrl" class="min-w-0 flex flex-col gap-0.5">
          <dt class="font-mono text-xs text-fg-muted m-0">
            {{ $t('package.provenance_section.public_ledger') }}
          </dt>
          <dd class="m-0 min-w-0">
            <a
              :href="details.publicLedgerUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="link text-sm inline-flex"
            >
              {{ $t('package.provenance_section.transparency_log_entry') }}
            </a>
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>
