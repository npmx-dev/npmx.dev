<script setup lang="ts">
import type { JsrPackageInfo } from '#shared/types/jsr'
import type { DevDependencySuggestion } from '#shared/utils/dev-dependency'
import type { PackageManagerId } from '~/utils/install-command'

const props = defineProps<{
  packageName: string
  requestedVersion?: string | null
  installVersionOverride?: string | null
  jsrInfo?: JsrPackageInfo | null
  devDependencySuggestion?: DevDependencySuggestion | null
  typesPackageName?: string | null
  showTypes?: boolean
  executableInfo?: { hasExecutable: boolean; primaryCommand?: string } | null
  createPackageInfo?: { packageName: string } | null
  selectedPm: PackageManagerId
}>()

// Matches the summary row's copy button style (Package/Install/Dropdown.vue) for visual consistency.
const copyButtonClass =
  'text-fg-muted bg-bg-subtle/80 border-border transition-all duration-150 hover:scale-105 active:scale-90 select-none'

const devDependencySuggestion = computed(
  () => props.devDependencySuggestion ?? { recommended: false as const },
)

function getDevInstallPartsForPM(pmId: PackageManagerId) {
  return getInstallCommandParts({
    packageName: props.packageName,
    packageManager: pmId,
    version: props.installVersionOverride ?? props.requestedVersion,
    jsrInfo: props.jsrInfo,
    dev: true,
  })
}

function getTypesInstallPartsForPM(pmId: PackageManagerId) {
  if (!props.typesPackageName) return []
  return getInstallCommandParts({
    packageName: props.typesPackageName,
    packageManager: pmId,
    jsrInfo: null,
    dev: true,
  })
}

function getRunPartsForPM(pmId: PackageManagerId, command?: string) {
  return getRunCommandParts({
    packageName: props.packageName,
    packageManager: pmId,
    jsrInfo: props.jsrInfo,
    command,
    isBinaryOnly: false,
  })
}

function getCreatePartsForPM(pmId: PackageManagerId) {
  if (!props.createPackageInfo) return []
  return getExecuteCommandParts({
    packageName: props.createPackageInfo.packageName,
    packageManager: pmId,
    jsrInfo: null,
    isCreatePackage: true,
  })
}

const { announce } = useCommandPalette()
const { polite } = useAnnouncer()

const { copied: devInstallCopied, copy: copyDevInstall } = useClipboard({ copiedDuring: 2000 })
function copyDevInstallCommand() {
  copyDevInstall(
    getInstallCommand({
      packageName: props.packageName,
      packageManager: props.selectedPm,
      version: props.installVersionOverride ?? props.requestedVersion,
      jsrInfo: props.jsrInfo,
      dev: true,
    }),
  )
  polite($t('package.command.copied_dev_install'))
  announce($t('command_palette.announcements.copied_to_clipboard'))
}

const { copied: typesInstallCopied, copy: copyTypesInstall } = useClipboard({ copiedDuring: 2000 })
function copyTypesInstallCommand() {
  if (!props.typesPackageName) return
  copyTypesInstall(
    getInstallCommand({
      packageName: props.typesPackageName,
      packageManager: props.selectedPm,
      jsrInfo: null,
      dev: true,
    }),
  )
  polite($t('package.command.copied_dev_install'))
  announce($t('command_palette.announcements.copied_to_clipboard'))
}

const { copied: runCopied, copy: copyRun } = useClipboard({ copiedDuring: 2000 })
function copyRunCommand(command?: string) {
  copyRun(
    getRunCommand({
      packageName: props.packageName,
      packageManager: props.selectedPm,
      jsrInfo: props.jsrInfo,
      command,
    }),
  )
  polite($t('package.command.copied_run'))
  announce($t('command_palette.announcements.copied_to_clipboard'))
}

const { copied: createCopied, copy: copyCreate } = useClipboard({ copiedDuring: 2000 })
function copyCreateCommand() {
  if (!props.createPackageInfo) return
  copyCreate(
    getExecuteCommand({
      packageName: props.createPackageInfo.packageName,
      packageManager: props.selectedPm,
      jsrInfo: null,
      isCreatePackage: true,
    }),
  )
  polite($t('package.command.copied_create'))
  announce($t('command_palette.announcements.copied_to_clipboard'))
}
</script>

<template>
  <!-- Suggested dev dependency install command -->
  <div
    v-if="devDependencySuggestion.recommended"
    class="flex items-center gap-3 px-2.5 py-2.5"
    data-testid="dev-install-command"
  >
    <ButtonBase
      type="button"
      :class="['shrink-0', copyButtonClass]"
      :aria-label="$t('package.get_started.copy_dev_command')"
      :classicon="devInstallCopied ? 'i-lucide:check' : 'i-lucide:copy'"
      @click.stop="copyDevInstallCommand"
    />
    <div class="min-w-0 flex-1">
      <p class="text-xs text-fg-subtle mb-0.5 select-none">
        {{ $t('package.get_started.dev_dependency_hint') }}
      </p>
      <code
        class="font-mono text-sm min-w-0 block truncate tracking-tight"
        dir="ltr"
        v-for="pm in packageManagers"
        :key="pm.id"
        :data-pm-additional-cmd="pm.id"
        ><span class="text-fg-subtle select-none">${{ ' ' }}</span
        ><span
          v-for="(part, i) in getDevInstallPartsForPM(pm.id)"
          :key="i"
          :class="
            i === getDevInstallPartsForPM(pm.id).length - 1
              ? 'text-fg font-medium'
              : 'text-fg-muted'
          "
          >{{ i > 0 ? ' ' : '' }}{{ part }}</span
        ></code
      >
    </div>
  </div>

  <!-- @types package install -->
  <div
    v-if="typesPackageName && showTypes"
    class="flex items-center gap-3 px-2.5 py-2.5"
    data-testid="types-install-command"
  >
    <ButtonBase
      type="button"
      :class="['shrink-0', copyButtonClass]"
      :aria-label="$t('command_palette.package_actions.copy_run')"
      :classicon="typesInstallCopied ? 'i-lucide:check' : 'i-lucide:copy'"
      @click.stop="copyTypesInstallCommand"
    />
    <div class="min-w-0 flex-1">
      <p class="text-xs text-fg-subtle mb-0.5 select-none">
        {{ $t('package.get_started.types_label') }}
      </p>
      <div class="flex items-center gap-2 min-w-0">
        <code
          class="font-mono text-sm min-w-0 truncate tracking-tight"
          dir="ltr"
          v-for="pm in packageManagers"
          :key="pm.id"
          :data-pm-additional-cmd="pm.id"
          ><span class="text-fg-subtle select-none">${{ ' ' }}</span
          ><span
            v-for="(part, i) in getTypesInstallPartsForPM(pm.id)"
            :key="i"
            :class="
              i === getTypesInstallPartsForPM(pm.id).length - 1
                ? 'text-fg font-medium'
                : 'text-fg-muted'
            "
            >{{ i > 0 ? ' ' : '' }}{{ part }}</span
          ></code
        >
        <NuxtLink
          :to="packageRoute(typesPackageName!)"
          class="shrink-0 text-fg-subtle hover:text-fg-muted text-xs transition-colors focus-visible:outline-accent/70 rounded select-none -m-1 p-1"
          :title="$t('package.get_started.view_types', { package: typesPackageName })"
        >
          <span class="i-lucide:arrow-right rtl-flip w-3 h-3 align-middle" aria-hidden="true" />
          <span class="sr-only">{{
            $t('package.get_started.view_types', { package: typesPackageName })
          }}</span>
        </NuxtLink>
      </div>
    </div>
  </div>

  <!-- Run command (only if package has executables) -->
  <div
    v-if="executableInfo?.hasExecutable"
    class="flex items-center gap-3 px-2.5 py-2.5"
    data-testid="run-command"
  >
    <ButtonBase
      type="button"
      :class="['shrink-0', copyButtonClass]"
      :aria-label="$t('package.run.copy_command')"
      :classicon="runCopied ? 'i-lucide:check' : 'i-lucide:copy'"
      @click.stop="copyRunCommand(executableInfo?.primaryCommand)"
    />
    <div class="min-w-0 flex-1">
      <p class="text-xs text-fg-subtle mb-0.5 select-none">{{ $t('package.run.locally') }}</p>
      <code
        class="font-mono text-sm min-w-0 block truncate tracking-tight"
        dir="ltr"
        v-for="pm in packageManagers"
        :key="pm.id"
        :data-pm-additional-cmd="pm.id"
        ><span class="text-fg-subtle select-none">${{ ' ' }}</span
        ><span
          v-for="(part, i) in getRunPartsForPM(pm.id, executableInfo?.primaryCommand)"
          :key="i"
          :class="
            i === getRunPartsForPM(pm.id, executableInfo?.primaryCommand).length - 1
              ? 'text-fg font-medium'
              : 'text-fg-muted'
          "
          >{{ i > 0 ? ' ' : '' }}{{ part }}</span
        ></code
      >
    </div>
  </div>

  <!-- Create command (for packages with associated create-* package) -->
  <div
    v-if="createPackageInfo"
    class="flex items-center gap-3 px-2.5 py-2.5"
    data-testid="create-command"
  >
    <ButtonBase
      type="button"
      :class="['shrink-0', copyButtonClass]"
      :aria-label="$t('package.create.copy_command')"
      :classicon="createCopied ? 'i-lucide:check' : 'i-lucide:copy'"
      @click.stop="copyCreateCommand"
    />
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <p class="text-xs text-fg-subtle mb-0.5 select-none">{{ $t('package.create.title') }}</p>
        <TooltipApp
          :text="$t('package.create.view', { packageName: createPackageInfo.packageName })"
        >
          <NuxtLink
            :to="packageRoute(createPackageInfo.packageName)"
            class="mb-0.5 inline-flex items-center justify-center min-w-5 min-h-5 -m-1 p-1 text-fg-muted hover:text-fg text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent/70 rounded"
          >
            <span class="i-lucide:info w-3 h-3" aria-hidden="true" />
            <span class="sr-only">{{
              $t('package.create.view', { packageName: createPackageInfo.packageName })
            }}</span>
          </NuxtLink>
        </TooltipApp>
      </div>
      <code
        class="font-mono text-sm min-w-0 block truncate tracking-tight"
        dir="ltr"
        v-for="pm in packageManagers"
        :key="pm.id"
        :data-pm-additional-cmd="pm.id"
        ><span class="text-fg-subtle select-none">${{ ' ' }}</span
        ><span
          v-for="(part, i) in getCreatePartsForPM(pm.id)"
          :key="i"
          :class="
            i === getCreatePartsForPM(pm.id).length - 1 ? 'text-fg font-medium' : 'text-fg-muted'
          "
          >{{ i > 0 ? ' ' : '' }}{{ part }}</span
        ></code
      >
    </div>
  </div>
</template>
<style>
/* Hide all variants by default when preference is set */
:root[data-pm] [data-pm-additional-cmd] {
  display: none;
}

/* Show only the matching package manager command */
:root[data-pm='npm'] [data-pm-additional-cmd='npm'],
:root[data-pm='pnpm'] [data-pm-additional-cmd='pnpm'],
:root[data-pm='yarn'] [data-pm-additional-cmd='yarn'],
:root[data-pm='bun'] [data-pm-additional-cmd='bun'],
:root[data-pm='deno'] [data-pm-additional-cmd='deno'],
:root[data-pm='vlt'] [data-pm-additional-cmd='vlt'] {
  display: inline;
}

/* Fallback: when no data-pm is set (SSR initial), show npm as default */
:root:not([data-pm]) [data-pm-additional-cmd]:not([data-pm-additional-cmd='npm']) {
  display: none;
}
</style>
