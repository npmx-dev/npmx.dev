<script setup lang="ts">
import type { Role, GitHubContributor } from '#server/api/contributors.get'
import { SPONSORS } from '~/assets/logos/sponsors'
import { OSS_PARTNERS } from '~/assets/logos/oss-partners'

const router = useRouter()
const canGoBack = useCanGoBack()

useSeoMeta({
  title: () => `${$t('about.title')} - npmx`,
  ogTitle: () => `${$t('about.title')} - npmx`,
  twitterTitle: () => `${$t('about.title')} - npmx`,
  description: () => $t('about.meta_description'),
  ogDescription: () => $t('about.meta_description'),
  twitterDescription: () => $t('about.meta_description'),
})

defineOgImageComponent('Default', {
  primaryColor: '#60a5fa',
  title: 'about npmx',
  description: 'a fast, modern browser for the **npm registry**',
})

const isMounted = shallowRef(false)
onMounted(() => {
  isMounted.value = true
})

const pmLinks = {
  npm: 'https://www.npmjs.com/',
  pnpm: 'https://pnpm.io/',
  yarn: 'https://yarnpkg.com/',
  bun: 'https://bun.sh/',
  deno: 'https://deno.com/',
  vlt: 'https://www.vlt.sh/',
}

const { data, status: contributorsStatus } = useLazyFetch('/api/contributors')

function isExpandable(c: GitHubContributor) {
  const isGovernance = c.role === 'steward' || c.role === 'maintainer'
  return (
    isGovernance ||
    !!c.bio ||
    !!c.company ||
    !!c.name ||
    !!c.location ||
    !!c.twitterUsername ||
    !!c.websiteUrl ||
    !!c.blueskyHandle ||
    !!c.mastodonUrl
  )
}

function* mapContributors(
  c: GitHubContributor[],
): Generator<GitHubContributor & { expandable: boolean }> {
  for (const x of c) {
    yield {
      ...x,
      expandable: isExpandable(x),
    }
  }
}

const contributors = computed(() => [...mapContributors(data.value ?? [])])

const roleLabels = computed(
  () =>
    ({
      steward: $t('about.team.role_steward'),
      maintainer: $t('about.team.role_maintainer'),
    }) as Partial<Record<Role, string>>,
)

// --- Popover Logic (Global Single Instance with Event Delegation) ---
// We use a single global popover instance for performance (especially in Firefox with many items).
// Event delegation on the list handles interactions, avoiding listeners on every item.
const activeContributor = shallowRef<GitHubContributor>()
const popoverPos = reactive({ top: 0, left: 0, align: 'center' as 'left' | 'center' | 'right' })
const panelRef = useTemplateRef<HTMLElement>('panelRef')
const activeBtnEl = shallowRef<HTMLElement>()
let closeTimer: ReturnType<typeof setTimeout> | undefined
let lastOpenTime = 0

// Mouse tracking for scroll interactions
let mouseX = 0
let mouseY = 0
let scrollTimer: ReturnType<typeof setTimeout> | undefined

function cancelClose() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = undefined
  }
}

function computePos(btn: HTMLElement) {
  const r = btn.getBoundingClientRect()
  const vw = window.innerWidth
  const POP_W = 256
  const GAP = 8

  popoverPos.top = r.bottom + GAP
  const center = r.left + r.width / 2

  if (center - POP_W / 2 < GAP) {
    popoverPos.align = 'left'
    popoverPos.left = r.left
  } else if (center + POP_W / 2 > vw - GAP) {
    popoverPos.align = 'right'
    popoverPos.left = r.right
  } else {
    popoverPos.align = 'center'
    popoverPos.left = center
  }
}

// DON'T MOVE aria-expanded to the template, Firefox performance issues
function setActiveBtnExpanded(btn: HTMLElement | null, value: boolean) {
  if (activeBtnDom && activeBtnDom !== btn) {
    activeBtnDom.removeAttribute('aria-controls')
    activeBtnDom.setAttribute('aria-expanded', 'false')
  }
  activeBtnDom = btn
  if (btn) {
    if (value) {
      btn.setAttribute('aria-expanded', 'true')
      btn.setAttribute('aria-controls', 'contributor-popover')
    } else {
      btn.setAttribute('aria-expanded', 'false')
      btn.removeAttribute('aria-controls')
    }
  }
}

function openById(id: number, btnEl: HTMLElement, focus = false) {
  const c = contributors.value.find(x => x.id === id)
  if (!c || !isExpandable(c)) return
  cancelClose()
  computePos(btnEl)
  activeBtnEl.value = btnEl
  setActiveBtnExpanded(btnEl, true)
  activeContributor.value = c
  lastOpenTime = Date.now()

  if (focus) {
    nextTick(() => {
      panelRef.value?.focus()
    })
  }
}

function scheduleCloseActive() {
  cancelClose()
  closeTimer = setTimeout(() => {
    setActiveBtnExpanded(null, false)
    activeContributor.value = undefined
  }, 80)
}

function getButtonFromEvent(e: Event): HTMLButtonElement | null {
  return (e.target as Element).closest('button[data-cid]')
}

function onListMouseEnter(e: MouseEvent) {
  const btn = getButtonFromEvent(e)
  if (!btn) return
  openById(Number(btn.dataset.cid), btn)
}

function onListMouseLeave(e: MouseEvent) {
  // only close if we exist >ul>
  const related = e.relatedTarget as Element | null
  if (related?.closest('[data-popover-panel]')) return
  if (!related?.closest('button[data-cid]')) scheduleCloseActive()
}

function onListClick(e: MouseEvent) {
  const btn = getButtonFromEvent(e)
  if (!btn) return
  const id = Number(btn.dataset.cid)
  if (activeContributor.value?.id === id && Date.now() - lastOpenTime > 50) {
    setActiveBtnExpanded(null, false)
    activeContributor.value = undefined
    // Return focus to button when closing via click
    btn.focus()
  } else {
    // Open and focus the panel for keyboard accessibility
    openById(id, btn, true)
  }
}

// Panel mouse events
function onPanelMouseLeave(e: MouseEvent) {
  const related = e.relatedTarget as Element | null
  if (!related?.closest('button[data-cid]')) scheduleCloseActive()
}

// Tab management inside the panel (manual focus)
function onPanelKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !panelRef.value) return
  const focusables = [...panelRef.value.querySelectorAll<HTMLElement>('a[href]')]
  if (!focusables.length) {
    e.preventDefault()
    activeBtnEl.value?.focus()
    return
  }

  const first = focusables[0]
  const last = focusables.at(-1)!

  if (e.shiftKey && document.activeElement === panelRef.value) {
    e.preventDefault()
    activeBtnEl.value?.focus()
    return
  }

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    // Keep open but focus button
    activeBtnEl.value?.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    setActiveBtnExpanded(null, false)
    activeContributor.value = undefined

    // Find next button
    const allBtns = [...document.querySelectorAll<HTMLElement>('button[data-cid]')]
    const idx = allBtns.indexOf(activeBtnEl.value!)
    const nextBtn = allBtns[idx + 1]

    if (nextBtn) {
      nextBtn.focus()
    } else {
      activeBtnEl.value?.focus()
    }
  }
}

// Document listeners
function onDocumentPointerDown(e: PointerEvent) {
  if (!activeContributor.value) return
  const t = e.target as Element
  if (!t.closest('[data-popover-panel]') && !t.closest('button[data-cid]')) {
    setActiveBtnExpanded(null, false)
    activeContributor.value = undefined
  }
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && activeContributor.value) {
    setActiveBtnExpanded(null, false)
    activeContributor.value = undefined
    activeBtnEl.value?.focus()
  }
}

function onMouseMove(e: MouseEvent) {
  mouseX = e.clientX
  mouseY = e.clientY
}

function checkHover() {
  const el = document.elementFromPoint(mouseX, mouseY)
  const btn = el?.closest('button[data-cid]') as HTMLElement | null
  if (btn) {
    openById(Number(btn.dataset.cid), btn)
  }
}

function onScroll() {
  if (activeContributor.value) {
    setActiveBtnExpanded(null, false)
    activeContributor.value = undefined
  }
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(checkHover, 150)
}

let activeBtnDom: HTMLElement | null = null

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('mousemove', onMouseMove, { passive: true })
})
onBeforeUnmount(() => {
  cancelClose()
  clearTimeout(scrollTimer)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('mousemove', onMouseMove)
})
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('about.heading') }}
          </h1>
          <button
            v-if="canGoBack"
            type="button"
            class="cursor-pointer inline-flex items-center gap-2 p-1.5 -mx-1.5 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70 shrink-0"
            @click="router.back()"
          >
            <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
            <span class="hidden sm:inline">{{ $t('nav.back') }}</span>
          </button>
        </div>
        <p class="text-fg-muted text-lg">
          {{ $t('tagline') }}
        </p>
      </header>

      <section class="max-w-none space-y-12">
        <div>
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('about.what_we_are.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="about.what_we_are.description" tag="span" scope="global">
              <template #betterUxDx>
                <strong class="text-fg">{{ $t('about.what_we_are.better_ux_dx') }}</strong>
              </template>
              <template #jsr>
                <LinkBase to="https://jsr.io/" no-new-tab-icon>JSR</LinkBase>
              </template>
            </i18n-t>
          </p>
          <p class="text-fg-muted leading-relaxed">
            <i18n-t keypath="about.what_we_are.admin_description" tag="span" scope="global">
              <template #adminUi>
                <strong class="text-fg">{{ $t('about.what_we_are.admin_ui') }}</strong>
              </template>
            </i18n-t>
          </p>
        </div>

        <div>
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('about.what_we_are_not.title') }}
          </h2>
          <ul class="space-y-3 text-fg-muted list-none p-0">
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>
                <strong class="text-fg">{{
                  $t('about.what_we_are_not.not_package_manager')
                }}</strong>
                {{ ' ' }}
                <i18n-t
                  keypath="about.what_we_are_not.package_managers_exist"
                  tag="span"
                  scope="global"
                >
                  <template #already>{{ $t('about.what_we_are_not.words.already') }}</template>
                  <template #people>
                    <LinkBase :to="pmLinks.npm" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.people')
                    }}</LinkBase>
                  </template>
                  <template #building>
                    <LinkBase :to="pmLinks.pnpm" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.building')
                    }}</LinkBase>
                  </template>
                  <template #really>
                    <LinkBase :to="pmLinks.yarn" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.really')
                    }}</LinkBase>
                  </template>
                  <template #cool>
                    <LinkBase :to="pmLinks.bun" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.cool')
                    }}</LinkBase>
                  </template>
                  <template #package>
                    <LinkBase :to="pmLinks.deno" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.package')
                    }}</LinkBase>
                  </template>
                  <template #managers>
                    <LinkBase :to="pmLinks.vlt" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.managers')
                    }}</LinkBase>
                  </template>
                </i18n-t>
              </span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>
                <strong class="text-fg">{{ $t('about.what_we_are_not.not_registry') }}</strong>
                {{ $t('about.what_we_are_not.registry_description') }}
              </span>
            </li>
          </ul>
        </div>

        <!-- Sponsors -->
        <div class="sponsors-logos">
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('about.sponsors.title') }}
          </h2>
          <AboutLogoList
            :list="SPONSORS"
            class="grid grid-cols-2 md:flex md:flex-row md:items-center"
          />
        </div>

        <!-- OSS partners -->
        <div>
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('about.oss_partners.title') }}
          </h2>
          <AboutLogoList :list="OSS_PARTNERS" class="items-center" />
        </div>

        <div>
          <h2 class="text-lg uppercase tracking-wider mb-4">
            {{ $t('about.team.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-6">
            {{ $t('about.contributors.description') }}
          </p>
          <section aria-labelledby="contributors-heading">
            <h3 id="contributors-heading" class="text-sm text-fg uppercase tracking-wider mb-4">
              {{
                $t(
                  'about.contributors.title',
                  { count: $n(contributors.length) },
                  contributors.length,
                )
              }}
            </h3>

            <div
              v-if="contributorsStatus === 'pending'"
              class="text-fg-subtle text-sm"
              role="status"
            >
              {{ $t('about.contributors.loading') }}
            </div>
            <div
              v-else-if="contributorsStatus === 'error'"
              class="text-fg-subtle text-sm"
              role="alert"
            >
              {{ $t('about.contributors.error') }}
            </div>
            <ul
              v-else-if="contributors.length"
              class="flex flex-wrap justify-center gap-2 list-none p-0 overflow-visible"
              @mouseover="onListMouseEnter"
              @mouseout="onListMouseLeave"
              @click="onListClick"
            >
              <li
                v-for="contributor in contributors"
                :key="contributor.id"
                class="relative h-12 w-12 list-none group"
                style="contain: layout style"
              >
                <LinkBase
                  v-if="!contributor.expandable"
                  :to="contributor.html_url"
                  :aria-label="contributor.login"
                  no-underline
                  no-new-tab-icon
                  class="group relative block h-12 w-12 rounded-lg transition-transform outline-none p-0 bg-transparent"
                >
                  <img
                    :src="`${contributor.avatar_url}&s=64`"
                    :alt="$t('about.contributors.avatar', { name: contributor.login })"
                    width="64"
                    height="64"
                    class="w-12 h-12 rounded-lg ring-2 ring-transparent transition-shadow duration-200 hover:ring-accent"
                  />
                  <span
                    class="pointer-events-none absolute -top-9 inset-is-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-xs px-2 py-1 shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100"
                    dir="ltr"
                    role="tooltip"
                  >
                    @{{ contributor.login }}
                  </span>
                </LinkBase>
                <button
                  v-else
                  type="button"
                  aria-expanded="false"
                  :data-cid="contributor.id"
                  :aria-label="contributor.login"
                  class="group relative block h-12 w-12 rounded-lg transition-transform duration-200 outline-none p-0 border-none cursor-pointer bg-transparent"
                >
                  <img
                    :src="`${contributor.avatar_url}&s=64`"
                    :alt="$t('about.contributors.avatar', { name: contributor.login })"
                    width="64"
                    height="64"
                    class="w-12 h-12 rounded-lg ring-2 ring-transparent transition-shadow duration-200 hover:ring-accent"
                  />
                </button>
              </li>
            </ul>
          </section>
        </div>
        <CallToAction />
      </section>
    </article>

    <Transition name="pop">
      <div
        v-if="activeContributor"
        id="contributor-popover"
        ref="panelRef"
        data-popover-panel
        role="group"
        tabindex="-1"
        :aria-label="activeContributor.name || activeContributor.login"
        class="contributor-popover"
        :class="`align-${popoverPos.align}`"
        :style="{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }"
        @mouseleave="onPanelMouseLeave"
        @keydown="onPanelKeydown"
      >
        <div
          class="flex flex-col gap-y-3 w-64 rounded-xl border border-border-subtle bg-bg-elevated p-4 shadow-2xl text-start"
        >
          <div class="flex flex-col gap-2 min-w-0">
            <span class="w-full font-sans font-bold text-fg leading-tight truncate block">
              {{ activeContributor.name || activeContributor.login }}
            </span>
            <div
              v-if="roleLabels[activeContributor.role]"
              class="font-mono text-3xs uppercase tracking-wider text-accent font-bold"
            >
              {{ roleLabels[activeContributor.role] }}
            </div>
            <p
              v-if="activeContributor.bio"
              class="font-sans text-xs text-fg-subtle line-clamp-3 leading-relaxed"
            >
              "{{ activeContributor.bio }}"
            </p>
            <div
              v-if="activeContributor.companyHTML"
              class="flex items-center gap-1 font-sans text-2xs text-fg-muted min-w-0"
            >
              <div class="i-lucide:building-2 size-3 shrink-0 text-accent/80" aria-hidden="true" />
              <div
                class="leading-relaxed break-words min-w-0 [&_a]:(text-accent no-underline hover:underline)"
                v-html="activeContributor.companyHTML"
              />
            </div>
            <div
              v-else-if="activeContributor.company"
              class="flex items-center gap-1 font-sans text-2xs text-fg-muted min-w-0"
            >
              <div class="i-lucide:building-2 size-3 shrink-0 text-accent/80" aria-hidden="true" />
              <span>{{ activeContributor.company }}</span>
            </div>
          </div>

          <div class="flex flex-col gap-2 text-3xs text-fg-subtle font-sans">
            <div v-if="activeContributor.location" class="flex items-center gap-1">
              <div class="i-lucide:map-pin size-3 shrink-0" aria-hidden="true" />
              <span class="truncate">{{ activeContributor.location }}</span>
            </div>
            <a
              v-if="activeContributor.websiteUrl"
              :href="activeContributor.websiteUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1 hover:text-accent transition-colors"
            >
              <div class="i-lucide:link size-3 shrink-0" aria-hidden="true" />
              <span class="truncate">{{
                activeContributor.websiteUrl.replace(/^https?:\/\//, '')
              }}</span>
            </a>
            <a
              v-if="activeContributor.twitterUsername"
              :href="`https://x.com/${activeContributor.twitterUsername}`"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1 hover:text-accent transition-colors"
            >
              <div class="i-simple-icons:x size-2.5 shrink-0" aria-hidden="true" />
              <span>@{{ activeContributor.twitterUsername }}</span>
            </a>
            <a
              v-if="activeContributor.blueskyHandle"
              :href="`https://bsky.app/profile/${activeContributor.blueskyHandle}`"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1 hover:text-accent transition-colors"
            >
              <div class="i-simple-icons:bluesky size-2.5 shrink-0" aria-hidden="true" />
              <span>@{{ activeContributor.blueskyHandle }}</span>
            </a>
            <a
              v-if="activeContributor.mastodonUrl"
              :href="activeContributor.mastodonUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1 hover:text-accent transition-colors"
            >
              <div class="i-simple-icons:mastodon size-2.5 shrink-0" aria-hidden="true" />
              <span class="truncate">{{
                activeContributor.mastodonUrl.replace(/^https?:\/\//, '').replace(/\/@?/, '@')
              }}</span>
            </a>
          </div>

          <div class="flex items-center justify-between border-t border-border-subtle pt-3">
            <a
              :href="activeContributor.html_url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-3xs text-fg-subtle font-mono hover:text-accent"
            >
              @{{ activeContributor.login }}
            </a>

            <a
              v-if="activeContributor.sponsors_url"
              :href="activeContributor.sponsors_url"
              :aria-label="$t('about.team.sponsor_aria', { name: activeContributor.login })"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1 rounded border border-purple-700/30 bg-purple-700/5 text-purple-700 dark:border-purple-300/30 dark:bg-purple-300/5 dark:text-purple-300 px-2 py-0.5 text-4xs font-bold uppercase tracking-wider transition-colors hover:bg-purple-700/15 dark:hover:bg-purple-300/15"
            >
              <span class="i-lucide:heart size-3" aria-hidden="true" />
              <span>{{ $t('about.team.sponsor') }}</span>
            </a>
          </div>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
[data-cid] img {
  transition:
    box-shadow 100ms ease,
    transform 200ms ease;
}

[data-cid][aria-expanded='true'] img {
  @apply ring-2 ring-accent;
  transform: scale(1.1);
  --un-ring-opacity: 1;
  --un-ring-color: color-mix(in srgb, var(--accent) var(--un-ring-opacity), transparent);
  box-shadow: 0 0 0 2px var(--un-ring-color);
}

@media (hover: hover) {
  [data-cid]:hover img,
  [data-cid][aria-expanded='true'] img {
    transform: scale(1.1);
    --un-ring-opacity: 1;
    --un-ring-color: color-mix(in srgb, var(--accent) var(--un-ring-opacity), transparent);
    box-shadow: 0 0 0 2px var(--un-ring-color);
  }
}

/* Capture tap/click (focus without keyboard navigation => for chrome tap) */
[data-cid]:focus:not(:focus-visible) img,
[data-cid]:focus-visible img {
  transform: scale(1.1);
  --un-ring-opacity: 1;
  --un-ring-color: color-mix(in srgb, var(--accent) var(--un-ring-opacity), transparent);
  box-shadow: 0 0 0 2px var(--un-ring-color);
}

[data-cid]:focus-visible {
  outline: none;
  z-index: 20;
}

/* FF popup outline */
.contributor-popover:focus {
  outline: none;
}

.contributor-popover {
  position: fixed;
  z-index: 9999;
  transform: translateX(-50%);
  /* GPU layer: avoid repaints in the main thread */
  will-change: opacity;
  contain: layout style;
  /* Remove focus outline from container:
     don't remove important to fix FF outline
  */
  outline: none !important;
  /* same computePos GAP */
  padding-top: 8px;
  margin-top: -8px;
}

.contributor-popover.align-left {
  transform: translateX(0);
}
.contributor-popover.align-right {
  transform: translateX(-100%);
}

.pop-enter-active {
  transition:
    opacity 100ms ease-out,
    transform 120ms ease-out;
}
.pop-leave-active {
  transition: opacity 60ms ease-in;
}
.pop-enter-from {
  opacity: 0;
}
.pop-leave-to {
  opacity: 0;
}
</style>
