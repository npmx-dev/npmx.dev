<script setup lang="ts">
import type { OsvSeverityLevel, SupplyChainAlertType } from '#shared/types/dependency-analysis'
import { SEVERITY_COLORS } from '#shared/utils/severity'

const props = defineProps<{
  packageName: string
  version: string
}>()

// Shares the cached fetch with PackageVulnerabilityTree
const { data: vulnTree, status } = useDependencyAnalysis(
  () => props.packageName,
  () => props.version,
)

const { effectiveSources, anySourceEnabled } = useSecuritySources()

// Display filter: only show alerts from enabled security data sources.
// The no-sources warning is rendered by PackageVulnerabilityTree; this
// component simply renders nothing in that state.
const alertPackages = computed(() => {
  if (!anySourceEnabled.value || !vulnTree.value) return []
  return filterVulnerabilityTreeBySources(vulnTree.value, effectiveSources.value)
    .supplyChainPackages
})

// Supply-chain alerts come exclusively from Socket. When the user has Socket
// enabled but the scan produced nothing (outage, quota, misconfiguration),
// say so instead of rendering nothing - silence would read as "all clear".
const socketScanFailed = computed(() => {
  if (!vulnTree.value || !effectiveSources.value.socket) return false
  const socketStatus = vulnTree.value.sourceStatus.socket
  return socketStatus !== 'ok' && socketStatus !== 'partial'
})

const totalAlerts = computed(() =>
  alertPackages.value.reduce((sum, pkg) => sum + pkg.alerts.length, 0),
)

const isExpanded = shallowRef(false)

const {
  visibleItems: visiblePackages,
  hasMore: hasMorePackages,
  expand: expandPackages,
} = useVisibleItems(alertPackages, 5)

const alertTypeLabels = computed<Record<SupplyChainAlertType, string>>(() => ({
  malware: $t('package.supply_chain.types.malware'),
  gptMalware: $t('package.supply_chain.types.gptMalware'),
  didYouMean: $t('package.supply_chain.types.didYouMean'),
  gptDidYouMean: $t('package.supply_chain.types.gptDidYouMean'),
  troll: $t('package.supply_chain.types.troll'),
  obfuscatedFile: $t('package.supply_chain.types.obfuscatedFile'),
  manifestConfusion: $t('package.supply_chain.types.manifestConfusion'),
  installScripts: $t('package.supply_chain.types.installScripts'),
  telemetry: $t('package.supply_chain.types.telemetry'),
  unstableOwnership: $t('package.supply_chain.types.unstableOwnership'),
}))

const severityLabels = computed<Record<OsvSeverityLevel, string>>(() => ({
  critical: $t('package.vulnerabilities.severity.critical'),
  high: $t('package.vulnerabilities.severity.high'),
  moderate: $t('package.vulnerabilities.severity.moderate'),
  low: $t('package.vulnerabilities.severity.low'),
  unknown: $t('package.vulnerabilities.severity.unknown'),
}))

// A critical alert anywhere in the tree (e.g. malware) makes the whole
// banner red; otherwise it matches the amber vulnerability banner
const hasCriticalAlert = computed(() =>
  alertPackages.value.some(pkg => pkg.alerts.some(alert => alert.severity === 'critical')),
)

const bannerColor = computed(() =>
  hasCriticalAlert.value
    ? 'border-red-600/40 bg-red-500/10 text-red-800 dark:text-red-400'
    : 'border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-400',
)

const depthStyles = {
  root: 'border-is-2 border-is-amber-600',
  direct: 'border-is-2 border-is-amber-500',
  transitive: 'border-is-2 border-is-amber-400',
} as const

function getDepthStyle(depth: string | undefined) {
  if (depth && depth in depthStyles) {
    return depthStyles[depth as keyof typeof depthStyles]
  }
  return depthStyles.transitive
}
</script>

<template>
  <section
    v-if="status === 'success' && alertPackages.length > 0"
    aria-labelledby="supply-chain-heading"
    class="relative"
  >
    <div role="alert" class="rounded-lg border overflow-hidden" :class="bannerColor">
      <!-- Header -->
      <button
        type="button"
        class="w-full flex items-center justify-between gap-3 px-4 py-3 text-start transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70"
        :aria-expanded="isExpanded"
        aria-controls="supply-chain-details"
        @click="isExpanded = !isExpanded"
      >
        <span class="flex items-center gap-2 min-w-0">
          <span class="i-lucide:shield-alert w-4 h-4 shrink-0" aria-hidden="true" />
          <span id="supply-chain-heading" class="font-mono text-sm font-medium truncate">
            {{ $t('package.supply_chain.alerts_found', { alerts: totalAlerts }, totalAlerts) }}
            {{
              $t(
                'package.supply_chain.in_packages',
                { packages: alertPackages.length },
                alertPackages.length,
              )
            }}
          </span>
        </span>
        <span class="flex items-center gap-2 shrink-0">
          <!-- all supply-chain alerts are sourced from Socket -->
          <SecuritySourceLogo source="socket" class="h-5" />
          <span
            class="i-lucide:chevron-down w-4 h-4 transition-transform duration-200"
            :class="{ 'rotate-180': isExpanded }"
            aria-hidden="true"
          />
        </span>
      </button>

      <!-- Expandable details -->
      <div
        v-show="isExpanded"
        id="supply-chain-details"
        class="border-t border-border bg-bg-subtle"
      >
        <ul class="divide-y divide-border list-none m-0 p-0">
          <li
            v-for="pkg in visiblePackages"
            :key="`${pkg.name}@${pkg.version}`"
            class="px-4 py-3 bg-amber-500/5"
            :class="getDepthStyle(pkg.depth)"
          >
            <div class="flex items-center justify-between gap-2 mb-2">
              <div class="flex items-center gap-2 min-w-0 relative">
                <DependencyPathPopup v-if="pkg.path && pkg.path.length > 1" :path="pkg.path" />
                <NuxtLink
                  :to="packageRoute(pkg.name, pkg.version)"
                  class="font-mono text-sm font-medium hover:underline truncate shrink min-w-0 text-fg"
                >
                  {{ pkg.name }}@{{ pkg.version }}
                </NuxtLink>
              </div>
              <a
                :href="getSocketPackageUrl(pkg.name)"
                target="_blank"
                rel="noopener noreferrer"
                class="shrink-0 inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg hover:underline"
              >
                {{ $t('common.view_on.socket_dev') }}
                <span class="i-lucide:external-link w-3 h-3" aria-hidden="true" />
              </a>
            </div>
            <ul class="space-y-1 list-none m-0 p-0">
              <li
                v-for="alert in pkg.alerts"
                :key="alert.type"
                class="flex items-center gap-2 text-xs text-fg-muted"
              >
                <span
                  class="px-1.5 py-0.5 text-3xs font-mono rounded border shrink-0"
                  :class="SEVERITY_COLORS[alert.severity]"
                >
                  {{ severityLabels[alert.severity] }}
                </span>
                <span class="truncate">{{ alertTypeLabels[alert.type] }}</span>
              </li>
            </ul>
          </li>
        </ul>

        <button
          v-if="hasMorePackages"
          type="button"
          class="w-full px-4 py-2 text-xs font-mono text-fg-muted hover:text-fg border-t border-border transition-colors duration-200"
          @click="expandPackages"
        >
          {{
            $t('package.supply_chain.show_all_packages', {
              count: alertPackages.length,
            })
          }}
        </button>
      </div>
    </div>
  </section>

  <!-- Socket enabled but the scan produced no data - subtle, not alarming -->
  <section
    v-else-if="status === 'success' && anySourceEnabled && socketScanFailed"
    :aria-label="$t('package.supply_chain.scan_failed')"
  >
    <div class="rounded-lg border border-border bg-bg-subtle px-4 py-3">
      <div class="flex items-center gap-2">
        <span class="i-lucide:circle-alert w-4 h-4 text-fg-subtle" aria-hidden="true" />
        <span class="text-sm text-fg-muted">
          {{ $t('package.supply_chain.scan_failed') }}
        </span>
      </div>
    </div>
  </section>
</template>
