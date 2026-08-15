<script setup lang="ts">
import type { JsrPackageInfo } from '#shared/types/jsr'
import type { PackageManagerId } from '~/utils/install-command'
import { getPackageManagerConfig } from '~/utils/install-command'

/**
 * A terminal-style execute command display for binary-only packages.
 * Renders the currently selected package manager command.
 */

const props = defineProps<{
  packageName: string
  jsrInfo?: JsrPackageInfo | null
  isCreatePackage?: boolean
}>()

const selectedPM = useSelectedPackageManager()
const { polite } = useAnnouncer()
const selectedPackageManagerConfig = computed(() => getPackageManagerConfig(selectedPM.value))

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
const copyExecuteCommand = () => {
  copyExecute(getFullExecuteCommand())
  polite($t('package.command.copied_execute'))
}
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
        <div
          :data-pm-cmd="selectedPackageManagerConfig.id"
          class="flex items-center gap-2 group/executecmd"
        >
          <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
          <code class="font-mono text-sm"
            ><span
              v-for="(part, i) in getExecutePartsForPM(selectedPackageManagerConfig.id)"
              :key="i"
              :class="i === 0 ? 'text-fg' : 'text-fg-muted'"
              >{{ i > 0 ? ' ' : '' }}{{ part }}</span
            ></code
          >
          <ButtonBase
            type="button"
            class="text-fg-muted bg-bg-subtle/80 border-border media-mouse:opacity-0 media-mouse:group-hover/executecmd:opacity-100 media-mouse:focus-within:opacity-100 active:scale-95 focus-visible:opacity-100 select-none"
            :aria-label="$t('package.get_started.copy_command')"
            :classicon="executeCopied ? 'i-lucide:check' : 'i-lucide:copy'"
            @click.stop="copyExecuteCommand"
          />
        </div>
      </div>
    </div>
  </div>
</template>
