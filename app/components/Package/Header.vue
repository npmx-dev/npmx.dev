<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { CommandPaletteContextCommandInput } from '~/types/command-palette'
import { SCROLL_TO_TOP_THRESHOLD } from '~/composables/useScrollToTop'

const props = defineProps<{
  pkg?: Pick<SlimPackument, 'name' | 'versions' | 'dist-tags'> | null
  resolvedVersion?: string | null
  displayVersion?: PackumentVersion | null
  latestVersion?: SlimVersion | null
  provenanceData?: ProvenanceDetails | null
  provenanceStatus?: string | null
  page: 'main' | 'docs' | 'code' | 'diff' | 'timeline'
  versionUrlPattern: string
}>()

const { requestedVersion, orgName } = usePackageRoute()
const { scrollToTop } = useScrollToTop()
const packageHeaderHeight = usePackageHeaderHeight()

const header = useTemplateRef('header')
const isHeaderPinned = shallowRef(false)
const { height: headerHeight } = useElementBounding(header)

function isStickyPinned(el: HTMLElement | null): boolean {
  if (!el) return false

  const style = getComputedStyle(el)
  const top = parseFloat(style.top) || 0
  const rect = el.getBoundingClientRect()

  return Math.abs(rect.top - top) < 1
}

function checkHeaderPosition() {
  isHeaderPinned.value = isStickyPinned(header.value)
}

useEventListener('scroll', checkHeaderPosition, { passive: true })
useEventListener('resize', checkHeaderPosition)

onMounted(() => {
  checkHeaderPosition()
})

watch(
  headerHeight,
  value => {
    packageHeaderHeight.value = Math.max(0, value)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  packageHeaderHeight.value = 0
})

const navExtraOffsetStyle = { '--package-nav-extra': '0px' }

const { y: scrollY } = useScroll(window)
const showScrollToTop = computed(() => scrollY.value > SCROLL_TO_TOP_THRESHOLD)

const packageName = computed(() => props.pkg?.name ?? '')
const fundingUrl = computed(() => {
  let funding = props.displayVersion?.funding
  if (Array.isArray(funding)) funding = funding[0]

  if (!funding) return null

  return typeof funding === 'string' ? funding : funding.url
})

const { copied: copiedPkgName, copy: copyPkgName } = useClipboard({
  source: packageName,
  copiedDuring: 2000,
})

function hasProvenance(version: PackumentVersion | null): boolean {
  if (!version?.dist) return false
  return !!(version.dist as { attestations?: unknown }).attestations
}

const { announce } = useCommandPalette()

useCommandPaletteContextCommands(
  computed((): CommandPaletteContextCommandInput[] => {
    if (!packageName.value) return []

    const commands: CommandPaletteContextCommandInput[] = [
      {
        id: 'package-copy-name',
        group: 'package',
        label: $t('package.copy_name'),
        keywords: [packageName.value],
        iconClass: 'i-lucide:copy',
        action: () => {
          copyPkgName()
          announce($t('command_palette.announcements.copied_to_clipboard'))
        },
      },
    ]

    if (fundingUrl.value) {
      commands.push({
        id: 'package-link-funding',
        group: 'links',
        label: $t('package.links.fund'),
        keywords: [packageName.value, $t('package.links.fund')],
        iconClass: 'i-lucide:heart',
        href: fundingUrl.value,
      })
    }

    return commands
  }),
)

// Docs URL: use our generated API docs
const docsLink = computed(() => {
  if (!props.resolvedVersion) return null

  return {
    name: 'docs' as const,
    params: {
      path: [props.pkg?.name ?? '', 'v', props.resolvedVersion] satisfies [string, string, string],
    },
  }
})

const codeLink = computed((): RouteLocationRaw | null => {
  if (props.pkg == null || props.resolvedVersion == null) {
    return null
  }
  const split = props.pkg.name.split('/')
  return {
    name: 'code',
    params: {
      org: split.length === 2 ? split[0] : undefined,
      packageName: split.length === 2 ? split[1]! : split[0]!,
      version: props.resolvedVersion,
      filePath: '',
    },
  }
})

const mainLink = computed((): RouteLocationRaw | null => {
  if (props.pkg == null || props.resolvedVersion == null) {
    return null
  }
  return packageRoute(props.pkg.name, props.resolvedVersion)
})

const diffLink = computed((): RouteLocationRaw | null => {
  if (
    props.pkg == null ||
    props.resolvedVersion == null ||
    props.latestVersion == null ||
    props.latestVersion.version === props.resolvedVersion
  ) {
    return null
  }
  return diffRoute(props.pkg.name, props.resolvedVersion, props.latestVersion.version)
})

const timelineLink = computed((): RouteLocationRaw | null => {
  if (props.pkg == null || props.resolvedVersion == null) return null
  const split = props.pkg.name.split('/')
  return {
    name: 'timeline',
    params: {
      org: split.length === 2 ? split[0] : undefined,
      packageName: split.length === 2 ? split[1]! : split[0]!,
      version: props.resolvedVersion,
    },
  }
})

useShortcuts({
  '.': () => codeLink.value,
  'm': () => mainLink.value,
  'd': () => docsLink.value,
  'c': () => props.pkg && { name: 'compare' as const, query: { packages: props.pkg.name } },
  'f': () => diffLink.value,
  't': () => timelineLink.value,
})
</script>

<template>
  <!-- Package header -->
  <header class="bg-bg pt-5 pb-1 w-full container">
    <!-- Package name and version -->
    <div class="flex items-baseline justify-between gap-x-2 gap-y-1 flex-wrap min-w-0">
      <CopyToClipboardButton
        :copied="copiedPkgName"
        :copy-text="$t('package.copy_name')"
        class="flex flex-col items-start min-w-0"
        @click="copyPkgName()"
      >
        <h1
          class="font-mono text-lg sm:text-3xl font-medium min-w-0 break-words"
          :title="pkg?.name"
          dir="ltr"
        >
          <LinkBase v-if="orgName" :to="{ name: 'org', params: { org: orgName } }">
            @{{ orgName }}
          </LinkBase>
          <span v-if="orgName">/</span>
          <span :class="{ 'text-fg-muted': orgName }">
            {{ orgName ? pkg?.name.replace(`@${orgName}/`, '') : pkg?.name }}
          </span>
        </h1>
      </CopyToClipboardButton>
      <!-- Package metrics -->
      <div class="flex gap-2 flex-wrap items-stretch">
        <LinkBase
          variant="button-secondary"
          :to="{ name: 'compare', query: { packages: packageName } }"
          aria-keyshortcuts="c"
          classicon="i-lucide:git-compare"
        >
          <span class="max-sm:sr-only">{{ $t('package.links.compare_this_package') }}</span>
        </LinkBase>
        <PackageLikes :packageName />

        <LinkBase
          variant="button-secondary"
          v-if="fundingUrl"
          :to="fundingUrl"
          classicon="i-lucide:handshake text-accent"
        >
          <span class="max-sm:sr-only">{{ $t('package.links.fund') }}</span>
        </LinkBase>
      </div>
    </div>
  </header>
  <div
    ref="header"
    class="w-full bg-bg sticky top-14 z-10 border-b border-border pt-2"
    :class="[$style.packageHeader]"
    data-testid="package-subheader"
  >
    <div
      class="w-full container flex flex-col md:flex-row-reverse items-baseline justify-between gap-x-2 gap-y-1 flex-wrap"
    >
      <div
        class="flex items-center max-md:justify-between max-md:w-full max-md:flex-row-reverse gap-2"
      >
        <ButtonBase
          variant="secondary"
          :aria-label="$t('common.scroll_to_top')"
          @click="scrollToTop"
          classicon="i-lucide:arrow-up"
          :class="showScrollToTop ? '' : 'opacity-0 pointer-events-none select-none'"
          class="py-1.5 px-2.5 sm:me-2"
          :tabindex="showScrollToTop ? 0 : -1"
        />
        <div class="flex-inline items-center flex-nowrap gap-1 font-mono text-fg-muted">
          <template v-if="displayVersion && hasProvenance(displayVersion)">
            <TooltipApp
              :text="
                provenanceData && provenanceStatus !== 'pending'
                  ? $t('package.provenance_section.built_and_signed_on', {
                      provider: provenanceData.providerLabel,
                    })
                  : $t('package.verified_provenance')
              "
              position="bottom"
              strategy="fixed"
            >
              <LinkBase
                variant="button-secondary"
                :to="packageRoute(packageName, resolvedVersion, '#provenance')"
                :aria-label="$t('package.provenance_section.view_more_details')"
                classicon="i-lucide:shield-check"
                class="py-1.25 px-2 me-2"
              />
            </TooltipApp>
          </template>
          <!-- Version resolution indicator (e.g., "latest → 4.2.0") -->
          <template v-if="requestedVersion && resolvedVersion !== requestedVersion">
            <TooltipApp
              :text="requestedVersion"
              position="bottom"
              strategy="fixed"
              class="vertical-middle"
            >
              <span class="i-lucide:cable rtl-flip min-w-3 w-3 h-3 mx-1" aria-hidden="true" />
            </TooltipApp>
          </template>
          <!-- Version selector -->
          <VersionSelector
            v-if="resolvedVersion && pkg?.versions && pkg?.['dist-tags']"
            :package-name="packageName"
            :current-version="resolvedVersion"
            :versions="pkg.versions"
            :dist-tags="pkg['dist-tags']"
            :url-pattern="versionUrlPattern"
            position-class="max-md:inset-is-0 md:inset-ie-0"
          />
        </div>
      </div>
      <!-- Docs + Code — inline on desktop, floating bottom bar on mobile -->
      <nav
        v-if="resolvedVersion"
        :aria-label="$t('package.navigation')"
        class="flex gap-4 me-auto -mb-px max-w-full overflow-x-auto"
        :style="navExtraOffsetStyle"
        :class="$style.packageNav"
      >
        <LinkBase
          v-if="mainLink"
          :to="mainLink"
          aria-keyshortcuts="m"
          class="decoration-none border-b-2 p-1 hover:border-accent/50 lowercase focus-visible:[outline-offset:-2px]!"
          :class="page === 'main' ? 'border-accent text-accent!' : 'border-transparent'"
        >
          {{ $t('package.links.main') }}
        </LinkBase>
        <LinkBase
          v-if="docsLink"
          :to="docsLink"
          aria-keyshortcuts="d"
          class="decoration-none border-b-2 p-1 hover:border-accent/50 focus-visible:[outline-offset:-2px]!"
          :class="page === 'docs' ? 'border-accent text-accent!' : 'border-transparent'"
        >
          {{ $t('package.links.docs') }}
        </LinkBase>
        <LinkBase
          v-if="codeLink"
          :to="codeLink"
          aria-keyshortcuts="."
          class="decoration-none border-b-2 p-1 hover:border-accent/50 focus-visible:[outline-offset:-2px]!"
          :class="page === 'code' ? 'border-accent text-accent!' : 'border-transparent'"
        >
          {{ $t('package.links.code') }}
        </LinkBase>
        <LinkBase
          v-if="diffLink"
          :to="diffLink"
          :title="$t('compare.compare_versions_title')"
          aria-keyshortcuts="f"
          class="decoration-none border-b-2 p-1 hover:border-accent/50 focus-visible:[outline-offset:-2px]!"
          :class="page === 'diff' ? 'border-accent text-accent!' : 'border-transparent'"
        >
          {{ $t('compare.compare_versions') }}
        </LinkBase>
        <LinkBase
          v-if="timelineLink"
          :to="timelineLink"
          aria-keyshortcuts="t"
          class="decoration-none border-b-2 p-1 hover:border-accent/50 focus-visible:[outline-offset:-2px]!"
          :class="page === 'timeline' ? 'border-accent text-accent!' : 'border-transparent'"
        >
          {{ $t('package.links.timeline') }}
        </LinkBase>
      </nav>
    </div>
  </div>
</template>

<style module>
.packageHeader h1 {
  overflow-wrap: anywhere;
}

.packageHeader p {
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
}

.packageNav {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.packageNav::-webkit-scrollbar {
  display: none;
}

@media (max-width: 639.9px) {
  .packageNav > :global(a kbd) {
    display: none;
  }
}
</style>
