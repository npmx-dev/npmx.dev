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
    class="group"
    :class="{
      'text-fg underline-offset-4 underline decoration-1 decoration-fg/50 hover:(no-underline text-fg/80) transition-colors duration-200':
        variant === 'link',
      'gap-x-1 inline-flex gap-x-1 items-center justify-center font-mono border border-border rounded-md transition-all duration-200 aria-current:(bg-fg text-bg border-fg hover:enabled:(text-bg/50))':
        variant !== 'link',
      'text-sm px-4 py-2': variant !== 'tag' && variant !== 'link',
      'text-xs px-2 py-0.5': variant === 'tag',
      'bg-bg-muted text-fg-muted hover:(text-fg border-border-hover)': variant === 'tag',
      'text-bg bg-fg hover:(bg-fg/90)': variant === 'button-primary',
      'bg-transparent text-fg hover:(bg-fg text-bg border-fg)': variant === 'button-secondary',
    }"
    :to="to"
    :href="href"
    :aria-keyshortcuts="keyshortcut"
  >
    <slot />
    <kbd
      v-if="keyshortcut"
      class="inline-flex items-center justify-center w-4 h-4 text-xs text-fg bg-bg-muted border border-border rounded no-underline"
      aria-hidden="true"
    >
      {{ keyshortcut }}
    </kbd>
  </NuxtLink>
</template>
