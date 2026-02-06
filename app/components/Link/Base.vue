<script setup lang="ts">
import type { NuxtLinkProps } from '#app'

const props = withDefaults(
  defineProps<
    {
      /** Disabled links will be displayed as plain text */
      'disabled'?: boolean
      /**
       * `type` should never be used, because this will always be a link.
       *
       * If you want a button use `TagButton` instead.
       * */
      'type'?: never
      'variant'?: 'button-primary' | 'button-secondary' | 'tag' | 'link'

      'keyshortcut'?: string

      /**
       * Don't use this directly, use `keyshortcut` instead. Correcty HTML will be automatically generated and the shortcut will automatically be displayed in the UI.
       */
      'aria-keyshortcuts'?: never

      /**
       * Don't use this directly. This will automatically be set to `_blank` if `href` for external links.
       */
      'target'?: never

      /**
       * Don't use this directly. This will automatically be set to `_blank` if `href` for external links.
       */
      'rel'?: never

      'classicon'?: string
    } &
      /** This makes sure the link always has either `to` or `href` */
      (Required<Pick<NuxtLinkProps, 'to'>> | Required<Pick<NuxtLinkProps, 'href'>>) &
      NuxtLinkProps
  >(),
  { variant: 'link' },
)
</script>

<template>
  <span
    v-if="disabled"
    :class="{
      'opacity-50 inline-flex gap-x-1 items-center justify-center font-mono border border-transparent rounded-md':
        variant !== 'link',
      'text-sm px-4 py-2': variant !== 'tag' && variant !== 'link',
      'text-xs px-2 py-0.5': variant === 'tag',
      'bg-bg-muted text-fg-muted': variant === 'tag',
      'text-bg bg-fg': variant === 'button-primary',
      'bg-transparent text-fg': variant === 'button-secondary',
    }"
    ><slot
  /></span>
  <NuxtLink
    v-else
    class="group inline-flex gap-x-1 items-center justify-center"
    :class="{
      'text-fg underline-offset-[0.2rem] underline decoration-1 decoration-fg/50 hover:(no-underline text-accent) focus-visible:(no-underline text-accent) transition-colors duration-200':
        variant === 'link',
      'font-mono border border-border rounded-md transition-all duration-200 aria-current:(bg-fg text-bg border-fg hover:(text-bg/50)) bg-gradient-to-t dark:bg-gradient-to-b':
        variant !== 'link',
      'text-sm px-4 py-2': variant !== 'tag' && variant !== 'link',
      'text-xs px-2 py-0.5': variant === 'tag',
      'from-fg/10 via-transparent to-transparent text-fg hover:(bg-accent/20 border-accent) focus-visible:(bg-accent/20 border-accent)':
        variant === 'tag' || variant === 'button-secondary',
      'text-black from-accent via-accent to-accent/30 hover:(bg-accent/50) focus-visible:(bg-accent/50)':
        variant === 'button-primary',
    }"
    :to="to"
    :href="href"
    :aria-keyshortcuts="keyshortcut"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noopener noreferrer' : undefined"
  >
    <span
      v-if="classicon"
      :class="[variant === 'tag' ? 'size-3' : 'size-4', classicon]"
      aria-hidden="true"
    />
    <slot />
    <!-- automatically show icon indicating external link -->
    <span v-if="href" class="i-carbon:launch rtl-flip w-3 h-3 opacity-50" aria-hidden="true" />
    <kbd
      v-if="keyshortcut"
      class="inline-flex items-center justify-center w-4 h-4 text-xs text-fg bg-bg-muted border border-border rounded no-underline"
      aria-hidden="true"
    >
      {{ keyshortcut }}
    </kbd>
  </NuxtLink>
</template>
