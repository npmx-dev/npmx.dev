<script setup lang="ts">
import type { NuxtLinkProps } from '#app'

const props = withDefaults(
  defineProps<
    {
      /** Disabled links will be displayed as plain text */
      'disabled'?: boolean
      /**
       * `type` should never be used, because this will always be a link.
       * */
      'type'?: never
      'variant'?: 'button-primary' | 'button-secondary' | 'link'
      'size'?: 'small' | 'medium'

      'keyshortcut'?: string

      /**
       * Do not use this directly. Use keyshortcut instead; it generates the correct HTML and displays the shortcut in the UI.
       */
      'aria-keyshortcuts'?: never

      /**
       * Don't use this directly. This will automatically be set to `_blank` for external links passed via `to`.
       */
      'target'?: never

      /**
       * Don't use this directly. This will automatically be set for external links passed via `to`.
       */
      'rel'?: never

      'classicon'?: string

      'to'?: NuxtLinkProps['to']

      /** always use `to` instead of `href` */
      'href'?: never
    } & NuxtLinkProps
  >(),
  { variant: 'link', size: 'medium' },
)

const isLinkExternal = computed(
  () =>
    !!props.to &&
    typeof props.to === 'string' &&
    (props.to.startsWith('http:') || props.to.startsWith('https:') || props.to.startsWith('//')),
)
const isLinkAnchor = computed(
  () => !!props.to && typeof props.to === 'string' && props.to.startsWith('#'),
)

/** size is only applicable for button like links */
const isLink = computed(() => props.variant === 'link')
const isButton = computed(() => props.variant !== 'link')
const isButtonSmall = computed(() => props.size === 'small' && props.variant !== 'link')
const isButtonMedium = computed(() => props.size === 'medium' && props.variant !== 'link')
</script>

<template>
  <span
    v-if="disabled"
    :class="{
      'opacity-50 inline-flex gap-x-1 items-center justify-center font-mono border border-transparent rounded-md':
        isButton,
      'text-sm px-4 py-2': isButtonMedium,
      'text-xs px-2 py-0.5': isButtonSmall,
      'text-bg bg-fg': variant === 'button-primary',
      'bg-transparent text-fg': variant === 'button-secondary',
    }"
    ><slot
  /></span>
  <NuxtLink
    v-else
    class="group inline-flex gap-x-1 items-center justify-center"
    :class="{
      'underline-offset-[0.2rem] underline decoration-1 decoration-fg/30': !isLinkAnchor && isLink,
      'font-mono text-fg hover:(decoration-accent text-accent) focus-visible:(decoration-accent text-accent) transition-colors duration-200':
        isLink,
      'font-mono border border-border rounded-md transition-all duration-200': isButton,
      'text-sm px-4 py-2': isButtonMedium,
      'text-xs px-2 py-0.5': isButtonSmall,
      'bg-transparent text-fg hover:(bg-fg/10) focus-visible:(bg-fg/10)':
        variant === 'button-secondary',
      'text-bg bg-fg hover:(bg-fg/50) focus-visible:(bg-fg/50)': variant === 'button-primary',
    }"
    :to="to"
    :aria-keyshortcuts="keyshortcut"
    :target="isLinkExternal ? '_blank' : undefined"
  >
    <span
      v-if="classicon"
      :class="[isButtonSmall ? 'size-3' : 'size-4', classicon]"
      aria-hidden="true"
    />
    <slot />
    <!-- automatically show icon indicating external link -->
    <span
      v-if="isLinkExternal && !classicon"
      class="i-carbon:launch rtl-flip w-3 h-3 opacity-50"
      aria-hidden="true"
    />
    <span
      v-else-if="isLinkAnchor && isLink"
      class="i-carbon:link w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      aria-hidden="true"
    />
    <kbd
      v-if="keyshortcut"
      class="ms-2 inline-flex items-center justify-center w-4 h-4 text-xs text-fg bg-bg-muted border border-border rounded no-underline"
      aria-hidden="true"
    >
      {{ keyshortcut }}
    </kbd>
  </NuxtLink>
</template>
