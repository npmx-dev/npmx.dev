<script setup lang="ts">
import type { KeytraceAccount } from '#shared/types/keytrace'

const legendTooltipVisible = ref(false)

function showLegendTooltip() {
  legendTooltipVisible.value = true
}

function hideLegendTooltip() {
  legendTooltipVisible.value = false
}

const statusLegend = computed(() => [
  {
    labelKey: 'profile.linked_accounts.status.verified',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  {
    labelKey: 'profile.linked_accounts.status.unverified',
    className: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  },
  {
    labelKey: 'profile.linked_accounts.status.stale',
    className: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  },
  {
    labelKey: 'profile.linked_accounts.status.failed',
    className: 'bg-red-500/15 text-red-300 border-red-500/30',
  },
])

const props = defineProps<{
  identity: string
  accounts: KeytraceAccount[]
  loading?: boolean
}>()

const verifiedCount = computed(
  () => props.accounts.filter(account => account.status === 'verified').length,
)
</script>

<template>
  <section class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <h2 class="font-mono text-xl sm:text-2xl font-medium">
          {{ $t('profile.linked_accounts.title') }}
        </h2>
        <TooltipBase
          :is-visible="legendTooltipVisible"
          position="bottom"
          :offset="8"
          interactive
          @mouseenter="showLegendTooltip"
          @mouseleave="hideLegendTooltip"
          @focusin="showLegendTooltip"
          @focusout="hideLegendTooltip"
        >
          <button
            type="button"
            class="size-6 rounded-full flex items-center justify-center text-fg-muted hover:text-fg"
            :aria-label="$t('profile.linked_accounts.legend_info_title')"
          >
            <span class="i-lucide:info size-4" aria-hidden="true" />
          </button>
          <template #content>
            <div class="p-3 max-w-xs text-sm">
              <p class="font-medium">{{ $t('profile.linked_accounts.legend_info_title') }}</p>
              <ul class="mt-2 text-fg-muted space-y-1 list-none p-0">
                <li>
                  <strong>{{ $t('profile.linked_accounts.status.verified') }}</strong
                  >: {{ $t('profile.linked_accounts.legend_verified') }}
                </li>
                <li>
                  <strong>{{ $t('profile.linked_accounts.status.unverified') }}</strong
                  >: {{ $t('profile.linked_accounts.legend_unverified') }}
                </li>
                <li>
                  <strong>{{ $t('profile.linked_accounts.status.stale') }}</strong
                  >: {{ $t('profile.linked_accounts.legend_stale') }}
                </li>
                <li>
                  <strong>{{ $t('profile.linked_accounts.status.failed') }}</strong
                  >: {{ $t('profile.linked_accounts.legend_failed') }}
                </li>
              </ul>
            </div>
          </template>
        </TooltipBase>
      </div>
      <p class="text-sm text-fg-muted">
        {{
          $t('profile.linked_accounts.verified_summary', {
            verified: verifiedCount,
            total: accounts.length,
          })
        }}
      </p>
    </div>

    <div
      class="mt-3 flex flex-wrap gap-2"
      :aria-label="$t('profile.linked_accounts.legend_aria_label')"
    >
      <span
        v-for="item in statusLegend"
        :key="item.labelKey"
        class="inline-flex items-center rounded-full border px-2 h-5 text-xs font-mono leading-5"
        :class="item.className"
      >
        {{ $t(item.labelKey) }}
      </span>
    </div>

    <div v-if="loading" class="mt-4 space-y-2">
      <SkeletonBlock v-for="index in 3" :key="index" class="h-20 rounded-md" />
    </div>

    <p v-else-if="!accounts.length" class="mt-4 text-fg-muted">
      {{ $t('profile.linked_accounts.empty') }}
    </p>

    <ul v-else class="mt-4 space-y-2">
      <li v-for="account in accounts" :key="`${account.platform}-${account.username}`">
        <AccountItem :account="account" :identity="identity" />
      </li>
    </ul>
  </section>
</template>
