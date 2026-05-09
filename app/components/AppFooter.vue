<script setup lang="ts">
import { NPMX_DOCS_SITE } from '#shared/utils/constants'

const route = useRoute()
const isHome = computed(() => route.name === 'index')
const { t } = useI18n()

const discord = useDiscordLink()
const { commandPaletteShortcutLabel } = usePlatformModifierKey()
const modalRef = useTemplateRef('modalRef')
const showModal = () => modalRef.value?.showModal?.()
const closeModal = () => modalRef.value?.close?.()

type FooterLink =
  | { name: string; href: string; type?: never }
  | { name: string; type: 'button'; onClick: () => void }

const socialLinks = computed(() => [
  {
    id: 'github',
    label: 'GitHub',
    href: 'https://repo.npmx.dev',
    icon: 'i-simple-icons:github',
  },
  {
    id: 'discord',
    label: 'Discord',
    href: discord.value.url,
    icon: 'i-simple-icons:discord',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    href: 'https://social.npmx.dev',
    icon: 'i-simple-icons:bluesky',
  },
])

const footerSections: Array<{ label: string; links: FooterLink[] }> = [
  {
    label: t('footer.resources'),
    links: [
      {
        name: t('footer.blog'),
        href: '/blog',
      },
      {
        name: t('footer.about'),
        href: '/about',
      },
      {
        name: t('footer.brand'),
        href: '/brand',
      },
      {
        name: t('a11y.footer_title'),
        href: '/accessibility',
      },
      {
        name: t('privacy_policy.title'),
        href: '/privacy',
      },
    ],
  },
  {
    label: t('footer.features'),
    links: [
      {
        name: t('shortcuts.compare'),
        href: '/compare',
      },
      {
        name: t('shortcuts.settings'),
        href: '/settings',
      },
      {
        name: t('footer.keyboard_shortcuts'),
        type: 'button',
        onClick: showModal,
      },
    ],
  },
  {
    label: t('footer.other'),
    links: [
      {
        name: t('pds.title'),
        href: '/pds',
      },
      {
        name: t('footer.docs'),
        href: NPMX_DOCS_SITE,
      },
    ],
  },
]
</script>

<template>
  <footer class="border-t border-border sm:mt-auto sm:pt-8 duration-200 transition-all">
    <div class="container flex flex-col gap-3">
      <!-- Desktop: Show all links. Mobile: Links are in MobileMenu -->
      <div
        class="hidden sm:flex flex-col lg:flex-row gap-6 lg:gap-0 lg:justify-between py-3 duration-200 transition-all"
      >
        <div class="flex flex-col gap-6">
          <div class="flex flex-col items-start gap-3">
            <AppLogo class="h-7 w-auto" />
            <BuildEnvironment v-if="!isHome" footer />
          </div>
          <div class="space-x-3">
            <NuxtLink
              v-for="link in socialLinks"
              :key="link.id"
              :to="link.href"
              :aria-label="link.label"
              target="_blank"
              rel="noopener noreferrer"
              class="text-fg-muted hover:text-accent transition-all duration-200"
            >
              <span :class="[link.icon, 'size-7']" aria-hidden="true" />
            </NuxtLink>
          </div>
        </div>

        <div class="font-mono flex gap-6">
          <div
            v-for="section in footerSections"
            :key="section.label"
            class="flex flex-col gap-3 min-w-40 max-w-50"
          >
            <p class="uppercase text-fg-muted">
              {{ section.label }}
            </p>
            <template v-for="link in section.links" :key="link.name">
              <button
                v-if="link.type === 'button'"
                type="button"
                aria-haspopup="dialog"
                @click="link.onClick"
                class="cursor-pointer text-start font-mono text-fg-subtle text-sm lowercase hover:text-accent transition-colors duration-200"
              >
                {{ link.name }}
              </button>

              <LinkBase
                v-else
                :to="link?.href"
                variant="link"
                noUnderline
                class="text-fg-subtle text-sm lowercase"
              >
                {{ link.name }}
              </LinkBase>
            </template>
          </div>
        </div>
      </div>

      <small
        class="border-border py-7.75 sm:border-t sm:py-4 duration-200 transition-all text-xs text-fg-muted text-center sm:text-start m-0"
      >
        <span class="lg:hidden">{{ $t('non_affiliation_disclaimer') }}</span>
        <span class="hidden lg:block">{{ $t('trademark_disclaimer') }}</span>
      </small>
    </div>

    <Modal
      id="keyboard-shortcuts-modal"
      ref="modalRef"
      :modalTitle="$t('footer.keyboard_shortcuts')"
      class="w-auto max-w-lg"
    >
      <p class="mb-4 text-sm leading-relaxed text-fg-muted">
        {{
          $t('shortcuts.command_palette_description', {
            ctrlKey: $t('shortcuts.ctrl_key'),
          })
        }}
      </p>
      <p class="mb-2 font-mono text-fg-subtle">
        {{ $t('shortcuts.section.global') }}
      </p>
      <ul class="mb-6 flex flex-col gap-2">
        <li class="flex gap-2 items-center">
          <kbd class="kbd">{{ commandPaletteShortcutLabel }}</kbd>
          <span>{{ $t('shortcuts.command_palette') }}</span>
        </li>
        <li class="flex gap-2 items-center">
          <kbd class="kbd">/</kbd>
          <span>{{ $t('shortcuts.focus_search') }}</span>
        </li>
        <li class="flex gap-2 items-center">
          <kbd class="kbd">?</kbd>
          <span>{{ $t('shortcuts.show_kbd_hints') }}</span>
        </li>
        <li class="flex gap-2 items-center">
          <kbd class="kbd">,</kbd>
          <span>{{ $t('shortcuts.settings') }}</span>
        </li>
        <li class="flex gap-2 items-center">
          <kbd class="kbd">c</kbd>
          <span>{{ $t('shortcuts.compare') }}</span>
        </li>
      </ul>
      <p class="mb-2 font-mono text-fg-subtle">
        {{ $t('shortcuts.section.search') }}
      </p>
      <ul class="mb-6 flex flex-col gap-2">
        <li class="flex gap-2 items-center">
          <kbd class="kbd">↑</kbd>/<kbd class="kbd">↓</kbd>
          <span>{{ $t('shortcuts.navigate_results') }}</span>
        </li>
        <li class="flex gap-2 items-center">
          <kbd class="kbd">Enter</kbd>
          <span>{{ $t('shortcuts.go_to_result') }}</span>
        </li>
      </ul>
      <p class="mb-2 font-mono text-fg-subtle">
        {{ $t('shortcuts.section.package') }}
      </p>
      <ul class="mb-8 flex flex-col gap-2">
        <li class="flex gap-2 items-center">
          <kbd class="kbd">m</kbd>
          <span>{{ $t('shortcuts.open_main') }}</span>
        </li>
        <li class="flex gap-2 items-center">
          <kbd class="kbd">d</kbd>
          <span>{{ $t('shortcuts.open_docs') }}</span>
        </li>
        <li class="flex gap-2 items-center">
          <kbd class="kbd">.</kbd>
          <span>{{ $t('shortcuts.open_code_view') }}</span>
        </li>
        <li class="flex gap-2 items-center">
          <kbd class="kbd">f</kbd>
          <span>{{ $t('shortcuts.open_diff') }}</span>
        </li>
        <li class="flex gap-2 items-center">
          <kbd class="kbd">t</kbd>
          <span>{{ $t('shortcuts.open_timeline') }}</span>
        </li>
        <li class="flex gap-2 items-center">
          <kbd class="kbd">c</kbd>
          <span>{{ $t('shortcuts.compare_from_package') }}</span>
        </li>
      </ul>
      <p class="text-fg-muted leading-relaxed">
        <i18n-t keypath="shortcuts.disable_shortcuts" tag="span" scope="global">
          <template #settings>
            <NuxtLink
              :to="{ name: 'settings' }"
              class="hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
              @click="closeModal"
            >
              {{ $t('settings.title') }}
            </NuxtLink>
          </template>
        </i18n-t>
      </p>
    </Modal>
  </footer>
</template>

<style scoped>
.kbd {
  @apply items-center justify-center text-xs text-fg bg-bg-muted border border-border rounded px-2;
}
</style>
