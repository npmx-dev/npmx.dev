<script setup lang="ts">
import type { JsrPackageInfo } from '#shared/types/jsr'
import type { PackageManagerId } from '~/utils/install-command'

/**
 * A terminal-style execute command display for binary-only packages.
 * Renders all package manager variants with CSS-based visibility.
 */

const props = defineProps<{
  packageName: string
  jsrInfo?: JsrPackageInfo | null
  isCreatePackage?: boolean
}>()

const selectedPM = useSelectedPackageManager()

// Generate execute command parts for a specific package manager
function getExecutePartsForPM(pmId: PackageManagerId) {
  return getExecuteCommandParts({
    packageName: props.packageName,
    packageManager: pmId,
    jsrInfo: props.jsrInfo,
    isBinaryOnly: true,
    isCreatePackage: props.isCreatePackage,
  })
}

// Full execute command for copying (uses current selected PM)
function getFullExecuteCommand() {
  return getExecuteCommand({
    packageName: props.packageName,
    packageManager: selectedPM.value,
    jsrInfo: props.jsrInfo,
    isBinaryOnly: true,
    isCreatePackage: props.isCreatePackage,
  })
}

// Copy handler
const { copied: executeCopied, copy: copyExecute } = useClipboard({ copiedDuring: 2000 })
const copyExecuteCommand = () => copyExecute(getFullExecuteCommand())
</script>

<template>
  <div class="relative group">
    <!-- Terminal-style execute command -->
    <div class="bg-bg-subtle border border-border rounded-lg overflow-hidden">
      <div class="flex gap-1.5 px-3 pt-2 sm:px-4 sm:pt-3">
        <span class="w-2.5 h-2.5 rounded-full bg-fg-subtle" />
        <span class="w-2.5 h-2.5 rounded-full bg-fg-subtle" />
        <span class="w-2.5 h-2.5 rounded-full bg-fg-subtle" />
      </div>
      <div class="px-3 pt-2 pb-3 sm:px-4 sm:pt-3 sm:pb-4 space-y-1">
        <!-- Execute command - render all PM variants, CSS controls visibility -->
        <div
          v-for="pm in packageManagers"
          :key="`execute-${pm.id}`"
          :data-pm-cmd="pm.id"
          class="flex items-center gap-2 group/executecmd"
        >
          <span class="text-fg-subtle font-mono text-sm select-none">$</span>
          <code class="font-mono text-sm"
            ><span
              v-for="(part, i) in getExecutePartsForPM(pm.id)"
              :key="i"
              :class="i === 0 ? 'text-fg' : 'text-fg-muted'"
              >{{ i > 0 ? ' ' : '' }}{{ part }}</span
            ></code
          >
          <button
            type="button"
            class="px-2 py-0.5 font-mono text-xs text-fg-muted bg-bg-subtle/80 border border-border rounded transition-colors duration-200 opacity-0 group-hover/executecmd:opacity-100 hover:(text-fg border-border-hover) active:scale-95 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            :aria-label="$t('package.get_started.copy_command')"
            @click.stop="copyExecuteCommand"
          >
            {{ executeCopied ? $t('common.copied') : $t('common.copy') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Hide all variants by default when preference is set */
:root[data-pm] [data-pm-cmd] {
  display: none;
}

/* Show only the matching package manager command */
:root[data-pm='npm'] [data-pm-cmd='npm'],
:root[data-pm='pnpm'] [data-pm-cmd='pnpm'],
:root[data-pm='yarn'] [data-pm-cmd='yarn'],
:root[data-pm='bun'] [data-pm-cmd='bun'],
:root[data-pm='deno'] [data-pm-cmd='deno'],
:root[data-pm='vlt'] [data-pm-cmd='vlt'] {
  display: flex;
}

/* Fallback: when no data-pm is set (SSR initial), show npm as default */
:root:not([data-pm]) [data-pm-cmd]:not([data-pm-cmd='npm']) {
  display: none;
}
</style>
