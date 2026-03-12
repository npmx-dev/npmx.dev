<script setup lang="ts">
import type { PackumentVersion, ProvenanceDetails, SlimVersion } from '#shared/types'
import type { RouteLocationRaw } from 'vue-router'
import { SCROLL_TO_TOP_THRESHOLD } from '~/composables/useScrollToTop'
import { useModal } from '~/composables/useModal'
import { useAtproto } from '~/composables/atproto/useAtproto'
import { togglePackageLike } from '~/utils/atproto/likes'

const props = defineProps<{
  pkg: { name: string } | null
  resolvedVersion?: string | null
  displayVersion: PackumentVersion | null
  latestVersion: SlimVersion | null
  provenanceData: ProvenanceDetails | null
  provenanceStatus: string
  docsLink: RouteLocationRaw | null
  codeLink: RouteLocationRaw | null
  isBinaryOnly: boolean
}>()

const { requestedVersion, orgName } = usePackageRoute()
const { scrollToTop, isTouchDeviceClient } = useScrollToTop()
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
const showScrollToTop = computed(
  () => isTouchDeviceClient.value && scrollY.value > SCROLL_TO_TOP_THRESHOLD,
)

const packageName = computed(() => props.pkg?.name ?? '')
const compactNumberFormatter = useCompactNumberFormatter()

const { copied: copiedPkgName, copy: copyPkgName } = useClipboard({
  source: packageName,
  copiedDuring: 2000,
})

const { copied: copiedVersion, copy: copyVersion } = useClipboard({
  source: () => props.resolvedVersion ?? '',
  copiedDuring: 2000,
})

function hasProvenance(version: PackumentVersion | null): boolean {
  if (!version?.dist) return false
  return !!(version.dist as { attestations?: unknown }).attestations
}

//atproto
// TODO: Maybe set this where it's not loaded here every load?
const { user } = useAtproto()

const authModal = useModal('auth-modal')

const { data: likesData, status: likeStatus } = useFetch(
  () => `/api/social/likes/${packageName.value}`,
  {
    default: () => ({ totalLikes: 0, userHasLiked: false }),
    server: false,
  },
)

const isLoadingLikeData = computed(
  () => likeStatus.value === 'pending' || likeStatus.value === 'idle',
)

const isLikeActionPending = shallowRef(false)

const likeAction = async () => {
  if (user.value?.handle == null) {
    authModal.open()
    return
  }

  if (isLikeActionPending.value) return

  const currentlyLiked = likesData.value?.userHasLiked ?? false
  const currentLikes = likesData.value?.totalLikes ?? 0

  // Optimistic update
  likesData.value = {
    totalLikes: currentlyLiked ? currentLikes - 1 : currentLikes + 1,
    userHasLiked: !currentlyLiked,
  }

  isLikeActionPending.value = true

  try {
    const result = await togglePackageLike(packageName.value, currentlyLiked, user.value?.handle)

    isLikeActionPending.value = false

    if (result.success) {
      // Update with server response
      likesData.value = result.data
    } else {
      // Revert on error
      likesData.value = {
        totalLikes: currentLikes,
        userHasLiked: currentlyLiked,
      }
    }
  } catch {
    // Revert on error
    likesData.value = {
      totalLikes: currentLikes,
      userHasLiked: currentlyLiked,
    }
    isLikeActionPending.value = false
  }
}
</script>

<template>
  <!-- Package header -->
  <header
    class="sticky top-14 z-1 bg-bg py-2 border-border"
    ref="header"
    :class="[$style.packageHeader, { 'border-b': isHeaderPinned }]"
  >
    <!-- Package name and version -->
    <div class="flex items-baseline gap-x-2 gap-y-1 sm:gap-x-3 flex-wrap min-w-0">
      <CopyToClipboardButton
        :copied="copiedPkgName"
        :copy-text="$t('package.copy_name')"
        class="flex flex-col items-start min-w-0"
        @click="copyPkgName()"
      >
        <h1
          class="font-mono text-2xl sm:text-3xl font-medium min-w-0 break-words"
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

      <CopyToClipboardButton
        v-if="resolvedVersion"
        :copied="copiedVersion"
        :copy-text="$t('package.copy_version')"
        class="inline-flex items-baseline gap-1.5 font-mono text-base sm:text-lg text-fg-muted shrink-0"
        @click="copyVersion()"
      >
        <!-- Version resolution indicator (e.g., "latest → 4.2.0") -->
        <template v-if="requestedVersion && resolvedVersion !== requestedVersion">
          <span class="font-mono text-fg-muted text-sm" dir="ltr">{{ requestedVersion }}</span>
          <span class="i-lucide:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
        </template>

        <LinkBase
          v-if="requestedVersion && resolvedVersion !== requestedVersion"
          :to="packageRoute(packageName, resolvedVersion)"
          :title="$t('package.view_permalink')"
          dir="ltr"
          >{{ resolvedVersion }}</LinkBase
        >
        <span dir="ltr" v-else>v{{ resolvedVersion }}</span>

        <template v-if="hasProvenance(displayVersion)">
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
              size="small"
              to="#provenance"
              :aria-label="$t('package.provenance_section.view_more_details')"
              classicon="i-lucide:shield-check"
            />
          </TooltipApp>
        </template>
        <span
          v-if="requestedVersion && latestVersion && resolvedVersion !== latestVersion.version"
          class="text-fg-subtle text-sm shrink-0"
          >{{ $t('package.not_latest') }}</span
        >
      </CopyToClipboardButton>

      <!-- Docs + Code + Compare — inline on desktop, floating bottom bar on mobile -->
      <ButtonGroup
        v-if="resolvedVersion"
        as="nav"
        :aria-label="$t('package.navigation')"
        class="hidden sm:flex max-sm:flex max-sm:fixed max-sm:z-40 max-sm:inset-is-1/2 max-sm:-translate-x-1/2 max-sm:rtl:translate-x-1/2 max-sm:bg-[--bg]/90 max-sm:backdrop-blur-md max-sm:border max-sm:border-border max-sm:rounded-md max-sm:shadow-md ms-auto"
        :style="navExtraOffsetStyle"
        :class="$style.packageNav"
      >
        <LinkBase
          variant="button-secondary"
          v-if="docsLink"
          :to="docsLink"
          aria-keyshortcuts="d"
          classicon="i-lucide:file-text"
        >
          <span class="max-sm:sr-only">{{ $t('package.links.docs') }}</span>
        </LinkBase>
        <LinkBase
          v-if="codeLink"
          variant="button-secondary"
          :to="codeLink"
          aria-keyshortcuts="."
          classicon="i-lucide:code"
        >
          <span class="max-sm:sr-only">{{ $t('package.links.code') }}</span>
        </LinkBase>
        <LinkBase
          variant="button-secondary"
          :to="{ name: 'compare', query: { packages: packageName } }"
          aria-keyshortcuts="c"
          classicon="i-lucide:git-compare"
        >
          <span class="max-sm:sr-only">{{ $t('package.links.compare') }}</span>
        </LinkBase>
        <LinkBase
          v-if="displayVersion && latestVersion && displayVersion.version !== latestVersion.version"
          variant="button-secondary"
          :to="diffRoute(packageName, displayVersion.version, latestVersion.version)"
          classicon="i-lucide:diff"
          :title="$t('compare.compare_versions_title')"
        >
          <span class="max-sm:sr-only">{{ $t('compare.compare_versions') }}</span>
        </LinkBase>
        <ButtonBase
          v-if="showScrollToTop"
          variant="secondary"
          :aria-label="$t('common.scroll_to_top')"
          @click="scrollToTop"
          classicon="i-lucide:arrow-up"
          class="sm:p-2.75"
        />
      </ButtonGroup>

      <!-- Package metrics -->
      <div class="basis-full flex gap-2 sm:gap-3 flex-wrap items-stretch">
        <PackageMetricsBadges
          v-if="resolvedVersion"
          :package-name="packageName"
          :version="resolvedVersion"
          :is-binary="isBinaryOnly"
          class="self-baseline"
        />

        <!-- Package likes -->
        <TooltipApp
          :text="
            isLoadingLikeData
              ? $t('common.loading')
              : likesData?.userHasLiked
                ? $t('package.likes.unlike')
                : $t('package.likes.like')
          "
          position="bottom"
          class="items-center"
          strategy="fixed"
        >
          <ButtonBase
            @click="likeAction"
            size="small"
            :aria-label="
              likesData?.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')
            "
            :aria-pressed="likesData?.userHasLiked"
            :classicon="
              likesData?.userHasLiked ? 'i-lucide:heart-minus text-red-500' : 'i-lucide:heart-plus'
            "
          >
            <span
              v-if="isLoadingLikeData"
              class="i-svg-spinners:ring-resize w-3 h-3 my-0.5"
              aria-hidden="true"
            />
            <span v-else>
              {{ compactNumberFormatter.format(likesData?.totalLikes ?? 0) }}
            </span>
          </ButtonBase>
        </TooltipApp>
      </div>
    </div>
  </header>
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

@media (max-width: 639.9px) {
  .packageNav {
    bottom: calc(1.25rem + var(--package-nav-extra, 0px) + env(safe-area-inset-bottom, 0px));
  }

  .packageNav > :global(a kbd) {
    display: none;
  }
}
</style>
