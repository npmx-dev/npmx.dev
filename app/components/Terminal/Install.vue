<script setup lang="ts">
import type { JsrPackageInfo } from '#shared/types/jsr'
import type { DevDependencySuggestion } from '#shared/utils/dev-dependency'
import type { PackageManagerId } from '~/utils/install-command'
import type { CommandPaletteContextCommandInput } from '~/types/command-palette'
import { getPackageManagerConfig } from '~/utils/install-command'

const props = defineProps<{
  packageName: string
  requestedVersion?: string | null
  installVersionOverride?: string | null
  jsrInfo?: JsrPackageInfo | null
  devDependencySuggestion?: DevDependencySuggestion | null
  typesPackageName?: string | null
  executableInfo?: { hasExecutable: boolean; primaryCommand?: string } | null
  createPackageInfo?: { packageName: string } | null
}>()

const { selectedPM, showTypesInInstall, copied, copyInstallCommand } = useInstallCommand(
  () => props.packageName,
  () => props.requestedVersion ?? null,
  () => props.jsrInfo ?? null,
  () => props.typesPackageName ?? null,
  () => props.installVersionOverride ?? null,
)

const { announce } = useCommandPalette()
const { polite } = useAnnouncer()

async function copyInstallCommandWithAnnounce() {
  const success = await copyInstallCommand()
  if (success) polite($t('package.command.copied_install'))
}

// Generate install command parts for a specific package manager
function getInstallPartsForPM(pmId: PackageManagerId) {
  return getInstallCommandParts({
    packageName: props.packageName,
    packageManager: pmId,
    version: props.installVersionOverride ?? props.requestedVersion,
    jsrInfo: props.jsrInfo,
  })
}

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
  return getExecuteCommandParts({
    packageName: props.createPackageInfo.packageName,
    packageManager: pmId,
    jsrInfo: null,
    isCreatePackage: true,
  })
}

// Generate @types install command parts for a specific package manager
function getTypesInstallPartsForPM(pmId: PackageManagerId) {
  if (!props.typesPackageName) return []
  return getInstallCommandParts({
    packageName: props.typesPackageName,
    packageManager: pmId,
    jsrInfo: null,
    dev: true,
  })
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
  if (!props.createPackageInfo) return ''

  return getExecuteCommand({
    packageName: props.createPackageInfo.packageName,
    packageManager: selectedPM.value,
    jsrInfo: null,
    isCreatePackage: true,
  })
}

// Copy handlers
const { copied: runCopied, copy: copyRun } = useClipboard({ copiedDuring: 2000 })
const copyRunCommand = (command?: string) => {
  copyRun(getFullRunCommand(command))
  polite($t('package.command.copied_run'))
}

const { copied: createCopied, copy: copyCreate } = useClipboard({ copiedDuring: 2000 })
const copyCreateCommand = () => {
  copyCreate(getFullCreateCommand())
  polite($t('package.command.copied_create'))
}

const { copied: devInstallCopied, copy: copyDevInstall } = useClipboard({ copiedDuring: 2000 })
const selectedPackageManagerConfig = computed(() => getPackageManagerConfig(selectedPM.value))
const copyDevInstallCommand = () => {
  copyDevInstall(
    getInstallCommand({
      packageName: props.packageName,
      packageManager: selectedPM.value,
      version: props.installVersionOverride ?? props.requestedVersion,
      jsrInfo: props.jsrInfo,
      dev: true,
    }),
  )
  polite($t('package.command.copied_dev_install'))
}

useCommandPaletteContextCommands(
  computed((): CommandPaletteContextCommandInput[] => {
    const commands: CommandPaletteContextCommandInput[] = [
      {
        id: 'package-copy-install',
        group: 'package',
        label: $t('package.get_started.copy_command'),
        keywords: [props.packageName],
        iconClass: 'i-lucide:copy',
        action: () => {
          copyInstallCommand()
          announce($t('command_palette.announcements.copied_to_clipboard'))
        },
      },
    ]

    if (devDependencySuggestion.value.recommended) {
      commands.push({
        id: 'package-copy-dev-install',
        group: 'package',
        label: $t('package.get_started.copy_dev_command'),
        keywords: [props.packageName],
        iconClass: 'i-lucide:copy-plus',
        action: () => {
          copyDevInstallCommand()
          announce($t('command_palette.announcements.copied_to_clipboard'))
        },
      })
    }

    if (props.executableInfo?.hasExecutable) {
      commands.push({
        id: 'package-copy-run',
        group: 'package',
        label: $t('command_palette.package_actions.copy_run'),
        keywords: [props.packageName, $t('package.run.locally')],
        iconClass: 'i-lucide:terminal-square',
        action: () => {
          copyRunCommand(props.executableInfo?.primaryCommand)
          announce($t('command_palette.announcements.copied_to_clipboard'))
        },
      })
    }

    if (props.createPackageInfo) {
      commands.push({
        id: 'package-copy-create',
        group: 'package',
        label: $t('package.create.copy_command'),
        keywords: [props.packageName, props.createPackageInfo.packageName],
        iconClass: 'i-lucide:wand-sparkles',
        action: () => {
          copyCreateCommand()
          announce($t('command_palette.announcements.copied_to_clipboard'))
        },
      })
    }

    if (props.typesPackageName && showTypesInInstall.value) {
      commands.push({
        id: 'package-view-types',
        group: 'package',
        label: $t('package.get_started.view_types', { package: props.typesPackageName }),
        keywords: [props.packageName, props.typesPackageName],
        iconClass: 'i-lucide:arrow-right',
        to: packageRoute(props.typesPackageName!),
      })
    }

    if (props.createPackageInfo) {
      commands.push({
        id: 'package-open-create-info',
        group: 'package',
        label: props.createPackageInfo.packageName,
        keywords: [props.packageName, props.createPackageInfo.packageName],
        iconClass: 'i-lucide:info',
        to: packageRoute(props.createPackageInfo.packageName),
      })
    }

    return commands
  }),
)
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
      <div class="px-3 pt-2 pb-3 sm:px-4 sm:pt-3 sm:pb-4 space-y-1 overflow-x-auto" dir="ltr">
        <div
          :data-pm-cmd="selectedPackageManagerConfig.id"
          class="flex items-center gap-2 group/installcmd min-w-0"
        >
          <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
          <code class="font-mono text-sm min-w-0"
            ><span
              v-for="(part, i) in getInstallPartsForPM(selectedPackageManagerConfig.id)"
              :key="i"
              :class="i === 0 ? 'text-fg' : 'text-fg-muted'"
              >{{ i > 0 ? ' ' : '' }}{{ part }}</span
            ></code
          >
          <ButtonBase
            type="button"
            class="text-fg-muted bg-bg-subtle/80 border-border media-mouse:opacity-0 media-mouse:group-hover/installcmd:opacity-100 media-mouse:focus-within:opacity-100 active:scale-95 focus-visible:opacity-100 select-none"
            :aria-label="$t('package.get_started.copy_command')"
            :classicon="copied ? 'i-lucide:check' : 'i-lucide:copy'"
            @click.stop="copyInstallCommandWithAnnounce"
          />
        </div>

        <!-- Suggested dev dependency install command -->
        <template v-if="devDependencySuggestion.recommended">
          <div class="flex items-center gap-2 pt-1 select-none">
            <span class="text-fg-subtle font-mono text-sm"
              ># {{ $t('package.get_started.dev_dependency_hint') }}</span
            >
          </div>
          <div
            :data-pm-cmd="selectedPackageManagerConfig.id"
            class="flex items-center gap-2 group/devinstallcmd min-w-0"
          >
            <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
            <code class="font-mono text-sm min-w-0"
              ><span
                v-for="(part, i) in getDevInstallPartsForPM(selectedPackageManagerConfig.id)"
                :key="i"
                :class="i === 0 ? 'text-fg' : 'text-fg-muted'"
                >{{ i > 0 ? ' ' : '' }}{{ part }}</span
              ></code
            >
            <ButtonBase
              type="button"
              class="text-fg-muted bg-bg-subtle/80 border-border media-mouse:opacity-0 media-mouse:group-hover/devinstallcmd:opacity-100 media-mouse:focus-within:opacity-100 active:scale-95 focus-visible:opacity-100 select-none"
              :aria-label="$t('package.get_started.copy_dev_command')"
              :classicon="devInstallCopied ? 'i-lucide:check' : 'i-lucide:copy'"
              @click.stop="copyDevInstallCommand"
            />
          </div>
        </template>

        <!-- @types package install - render all PM variants when types package exists -->
        <template v-if="typesPackageName && showTypesInInstall">
          <div
            :data-pm-cmd="selectedPackageManagerConfig.id"
            class="flex items-center gap-2 min-w-0"
          >
            <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
            <code class="font-mono text-sm min-w-0"
              ><span
                v-for="(part, i) in getTypesInstallPartsForPM(selectedPackageManagerConfig.id)"
                :key="i"
                :class="i === 0 ? 'text-fg' : 'text-fg-muted'"
                >{{ i > 0 ? ' ' : '' }}{{ part }}</span
              ></code
            >
            <NuxtLink
              :to="packageRoute(typesPackageName!)"
              class="text-fg-subtle hover:text-fg-muted text-xs transition-colors focus-visible:outline-accent/70 rounded select-none -m-1 p-1"
              :title="$t('package.get_started.view_types', { package: typesPackageName })"
            >
              <span class="i-lucide:arrow-right rtl-flip w-3 h-3 align-middle" aria-hidden="true" />
              <span class="sr-only">View {{ typesPackageName }}</span>
            </NuxtLink>
          </div>
        </template>

        <!-- Run command (only if package has executables) - render all PM variants -->
        <template v-if="executableInfo?.hasExecutable">
          <!-- Comment line -->
          <div class="flex items-center gap-2 pt-1" dir="auto">
            <span class="text-fg-subtle font-mono text-sm select-none"
              ># {{ $t('package.run.locally') }}</span
            >
          </div>

          <div
            :data-pm-cmd="selectedPackageManagerConfig.id"
            class="flex items-center gap-2 group/runcmd"
          >
            <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
            <code class="font-mono text-sm"
              ><span
                v-for="(part, i) in getRunPartsForPM(
                  selectedPackageManagerConfig.id,
                  executableInfo?.primaryCommand,
                )"
                :key="i"
                :class="i === 0 ? 'text-fg' : 'text-fg-muted'"
                >{{ i > 0 ? ' ' : '' }}{{ part }}</span
              ></code
            >
            <ButtonBase
              type="button"
              class="text-fg-muted bg-bg-subtle/80 border-border media-mouse:opacity-0 media-mouse:group-hover/runcmd:opacity-100 media-mouse:focus-within:opacity-100 active:scale-95 focus-visible:opacity-100 select-none"
              :aria-label="$t('package.run.copy_command')"
              :classicon="runCopied ? 'i-lucide:check' : 'i-lucide:copy'"
              @click.stop="copyRunCommand(executableInfo?.primaryCommand)"
            />
          </div>
        </template>

        <!-- Create command (for packages with associated create-* package) - render all PM variants -->
        <template v-if="createPackageInfo">
          <!-- Comment line -->
          <div class="flex items-center gap-2 pt-1 select-none" dir="auto">
            <span class="text-fg-subtle font-mono text-sm"># {{ $t('package.create.title') }}</span>
            <TooltipApp
              :text="$t('package.create.view', { packageName: createPackageInfo.packageName })"
            >
              <NuxtLink
                :to="packageRoute(createPackageInfo.packageName)"
                class="inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1 text-fg-muted hover:text-fg text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent/70 rounded"
              >
                <span class="i-lucide:info w-3 h-3" aria-hidden="true" />
                <span class="sr-only">{{
                  $t('package.create.view', { packageName: createPackageInfo.packageName })
                }}</span>
              </NuxtLink>
            </TooltipApp>
          </div>

          <div
            :data-pm-cmd="selectedPackageManagerConfig.id"
            class="flex items-center gap-2 group/createcmd"
          >
            <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
            <code class="font-mono text-sm"
              ><span
                v-for="(part, i) in getCreatePartsForPM(selectedPackageManagerConfig.id)"
                :key="i"
                :class="i === 0 ? 'text-fg' : 'text-fg-muted'"
                >{{ i > 0 ? ' ' : '' }}{{ part }}</span
              ></code
            >
            <ButtonBase
              type="button"
              class="text-fg-muted bg-bg-subtle/80 border-border media-mouse:opacity-0 media-mouse:group-hover/createcmd:opacity-100 media-mouse:focus-within:opacity-100 active:scale-95 focus-visible:opacity-100 select-none"
              :aria-label="$t('package.create.copy_command')"
              :classicon="createCopied ? 'i-lucide:check' : 'i-lucide:copy'"
              @click.stop="copyCreateCommand"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
