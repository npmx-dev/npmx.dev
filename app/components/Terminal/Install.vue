<script setup lang="ts">
import type { JsrPackageInfo } from '#shared/types/jsr'
import type { PackageManagerId } from '~/utils/install-command'

const props = defineProps<{
  packageName: string
  requestedVersion?: string | null
  jsrInfo?: JsrPackageInfo | null
  typesPackageName?: string | null
  executableInfo?: { hasExecutable: boolean; primaryCommand?: string } | null
  createPackageInfo?: { packageName: string } | null
}>()

const { selectedPM, showTypesInInstall, copied, copyInstallCommand } = useInstallCommand(
  () => props.packageName,
  () => props.requestedVersion ?? null,
  () => props.jsrInfo ?? null,
  () => props.typesPackageName ?? null,
)

// Generate install command parts for a specific package manager
function getInstallPartsForPM(pmId: PackageManagerId) {
  return getInstallCommandParts({
    packageName: props.packageName,
    packageManager: pmId,
    version: props.requestedVersion,
    jsrInfo: props.jsrInfo,
  })
}

// Generate run command parts for a specific package manager
function getRunPartsForPM(pmId: PackageManagerId, command?: string) {
  return getRunCommandParts({
    packageName: props.packageName,
    packageManager: pmId,
    jsrInfo: props.jsrInfo,
    command,
    isBinaryOnly: false,
  })
}

// Generate create command parts for a specific package manager
function getCreatePartsForPM(pmId: PackageManagerId) {
  if (!props.createPackageInfo) return []
  const pm = packageManagers.find(p => p.id === pmId)
  if (!pm) return []

  const createPkgName = props.createPackageInfo.packageName
  let shortName: string
  if (createPkgName.startsWith('@')) {
    const slashIndex = createPkgName.indexOf('/')
    const name = createPkgName.slice(slashIndex + 1)
    shortName = name.startsWith('create-') ? name.slice('create-'.length) : name
  } else {
    shortName = createPkgName.startsWith('create-')
      ? createPkgName.slice('create-'.length)
      : createPkgName
  }

  return [...pm.create.split(' '), shortName]
}

// Generate @types install command parts for a specific package manager
function getTypesInstallPartsForPM(pmId: PackageManagerId) {
  if (!props.typesPackageName) return []
  const pm = packageManagers.find(p => p.id === pmId)
  if (!pm) return []

  const devFlag = pmId === 'bun' ? '-d' : '-D'
  const pkgSpec = pmId === 'deno' ? `npm:${props.typesPackageName}` : props.typesPackageName

  return [pm.label, pm.action, devFlag, pkgSpec]
}

// Full run command for copying (uses current selected PM)
function getFullRunCommand(command?: string) {
  return getRunCommand({
    packageName: props.packageName,
    packageManager: selectedPM.value,
    jsrInfo: props.jsrInfo,
    command,
  })
}

// Full create command for copying (uses current selected PM)
function getFullCreateCommand() {
  return getCreatePartsForPM(selectedPM.value).join(' ')
}

// Copy handlers
const { copied: runCopied, copy: copyRun } = useClipboard({ copiedDuring: 2000 })
const copyRunCommand = (command?: string) => copyRun(getFullRunCommand(command))

const { copied: createCopied, copy: copyCreate } = useClipboard({ copiedDuring: 2000 })
const copyCreateCommand = () => copyCreate(getFullCreateCommand())
</script>

<template>
  <div class="relative group">
    <!-- Terminal-style install command -->
    <div class="bg-bg-subtle border border-border rounded-lg overflow-hidden">
      <div class="flex gap-1.5 px-3 pt-2 sm:px-4 sm:pt-3">
        <span class="w-2.5 h-2.5 rounded-full bg-fg-subtle" />
        <span class="w-2.5 h-2.5 rounded-full bg-fg-subtle" />
        <span class="w-2.5 h-2.5 rounded-full bg-fg-subtle" />
      </div>
      <div class="px-3 pt-2 pb-3 sm:px-4 sm:pt-3 sm:pb-4 space-y-1 overflow-x-auto">
        <!-- Install command - render all PM variants, CSS controls visibility -->
        <div
          v-for="pm in packageManagers"
          :key="`install-${pm.id}`"
          :data-pm-cmd="pm.id"
          class="flex items-center gap-2 group/installcmd min-w-0"
        >
          <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
          <code class="font-mono text-sm min-w-0"
            ><span
              v-for="(part, i) in getInstallPartsForPM(pm.id)"
              :key="i"
              :class="i === 0 ? 'text-fg' : 'text-fg-muted'"
              >{{ i > 0 ? ' ' : '' }}{{ part }}</span
            ></code
          >
          <button
            type="button"
            class="px-2 py-0.5 font-mono text-xs text-fg-muted bg-bg-subtle/80 border border-border rounded transition-colors duration-200 opacity-0 group-hover/installcmd:opacity-100 hover:(text-fg border-border-hover) active:scale-95 focus-visible:opacity-100 focus-visible:outline-accent/70"
            :aria-label="$t('package.get_started.copy_command')"
            @click.stop="copyInstallCommand"
          >
            <span aria-live="polite">{{ copied ? $t('common.copied') : $t('common.copy') }}</span>
          </button>
        </div>

        <!-- @types package install - render all PM variants when types package exists -->
        <template v-if="typesPackageName && showTypesInInstall">
          <div
            v-for="pm in packageManagers"
            :key="`types-${pm.id}`"
            :data-pm-cmd="pm.id"
            class="flex items-center gap-2 min-w-0"
          >
            <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
            <code class="font-mono text-sm min-w-0"
              ><span
                v-for="(part, i) in getTypesInstallPartsForPM(pm.id)"
                :key="i"
                :class="i === 0 ? 'text-fg' : 'text-fg-muted'"
                >{{ i > 0 ? ' ' : '' }}{{ part }}</span
              ></code
            >
            <NuxtLink
              :to="`/package/${typesPackageName}`"
              class="text-fg-subtle hover:text-fg-muted text-xs transition-colors focus-visible:outline-accent/70 rounded"
              :title="$t('package.get_started.view_types', { package: typesPackageName })"
            >
              <span class="i-carbon:arrow-right rtl-flip w-3 h-3 align-middle" aria-hidden="true" />
              <span class="sr-only">View {{ typesPackageName }}</span>
            </NuxtLink>
          </div>
        </template>

        <!-- Run command (only if package has executables) - render all PM variants -->
        <template v-if="executableInfo?.hasExecutable">
          <!-- Comment line -->
          <div class="flex items-center gap-2 pt-1">
            <span class="text-fg-subtle font-mono text-sm select-none"
              ># {{ $t('package.run.locally') }}</span
            >
          </div>

          <div
            v-for="pm in packageManagers"
            :key="`run-${pm.id}`"
            :data-pm-cmd="pm.id"
            class="flex items-center gap-2 group/runcmd"
          >
            <span class="text-fg-subtle font-mono text-sm select-none">$</span>
            <code class="font-mono text-sm"
              ><span
                v-for="(part, i) in getRunPartsForPM(pm.id, executableInfo?.primaryCommand)"
                :key="i"
                :class="i === 0 ? 'text-fg' : 'text-fg-muted'"
                >{{ i > 0 ? ' ' : '' }}{{ part }}</span
              ></code
            >
            <button
              type="button"
              class="px-2 py-0.5 font-mono text-xs text-fg-muted bg-bg-subtle/80 border border-border rounded transition-colors duration-200 opacity-0 group-hover/runcmd:opacity-100 hover:(text-fg border-border-hover) active:scale-95 focus-visible:opacity-100 focus-visible:outline-accent/70"
              @click.stop="copyRunCommand(executableInfo?.primaryCommand)"
            >
              {{ runCopied ? $t('common.copied') : $t('common.copy') }}
            </button>
          </div>
        </template>

        <!-- Create command (for packages with associated create-* package) - render all PM variants -->
        <template v-if="createPackageInfo">
          <!-- Comment line -->
          <div class="flex items-center gap-2 pt-1">
            <span class="text-fg-subtle font-mono text-sm select-none"
              ># {{ $t('package.create.title') }}</span
            >
            <TooltipApp
              :text="$t('package.create.view', { packageName: createPackageInfo.packageName })"
            >
              <NuxtLink
                :to="`/package/${createPackageInfo.packageName}`"
                class="inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1 text-fg-muted hover:text-fg text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent/70 rounded"
              >
                <span class="i-carbon:information w-3 h-3" aria-hidden="true" />
                <span class="sr-only">{{
                  $t('package.create.view', { packageName: createPackageInfo.packageName })
                }}</span>
              </NuxtLink>
            </TooltipApp>
          </div>

          <div
            v-for="pm in packageManagers"
            :key="`create-${pm.id}`"
            :data-pm-cmd="pm.id"
            class="flex items-center gap-2 group/createcmd"
          >
            <span class="text-fg-subtle font-mono text-sm select-none">$</span>
            <code class="font-mono text-sm"
              ><span
                v-for="(part, i) in getCreatePartsForPM(pm.id)"
                :key="i"
                :class="i === 0 ? 'text-fg' : 'text-fg-muted'"
                >{{ i > 0 ? ' ' : '' }}{{ part }}</span
              ></code
            >
            <button
              type="button"
              class="px-2 py-0.5 font-mono text-xs text-fg-muted bg-bg-subtle/80 border border-border rounded transition-colors duration-200 opacity-0 group-hover/createcmd:opacity-100 hover:(text-fg border-border-hover) active:scale-95 focus-visible:opacity-100 focus-visible:outline-accent/70"
              :aria-label="$t('package.create.copy_command')"
              @click.stop="copyCreateCommand"
            >
              <span aria-live="polite">{{
                createCopied ? $t('common.copied') : $t('common.copy')
              }}</span>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
/*
 * Package manager command visibility based on data-pm attribute on <html>.
 * All variants are rendered; CSS shows only the selected one.
 */

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
