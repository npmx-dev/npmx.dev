<script setup lang="ts">
import type { NuxtLinkProps } from '#app'

const props = withDefaults(
  defineProps<
    {
      /** Disabled links will be displayed as plain text */
      disabled?: boolean
      /**
       * Controls whether the link is styled as text or as a button.
       */
      type?: 'button' | 'link'
      size?: 'xs' | 'sm' | 'md' | 'lg'
      inline?: boolean

      ariaKeyshortcuts?: string

      /**
       * Don't use this directly. This will automatically be set to `_blank` for external links passed via `to`.
       */
      target?: never

      /**
       * Don't use this directly. This will automatically be set for external links passed via `to`.
       */
      rel?: never

      classicon?: string

      to?: NuxtLinkProps['to']

      /** always use `to` instead of `href` */
      href?: never

      /** should only be used for links where the context makes it very clear they are clickable. Don't just use this, because you don't like underlines. */
      noUnderline?: boolean
    } & NuxtLinkProps
  >(),
  { type: 'link', size: 'md', inline: true },
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

const isLink = computed(() => props.type === 'link')
const isButton = computed(() => props.type === 'button')
const sizeClass = computed(() => {
  if (isButton.value) {
    switch (props.size) {
      case 'xs':
        return 'text-xs px-2 py-0.5'
      case 'sm':
        return 'text-sm px-4 py-2'
      case 'md':
        return 'text-base px-5 py-2.5'
      case 'lg':
        return 'text-lg px-6 py-3'
    }
  }

  switch (props.size) {
    case 'xs':
      return 'text-xs'
    case 'sm':
      return 'text-sm'
    case 'md':
      return 'text-base'
    case 'lg':
      return 'text-lg'
  }
})
</script>

<template>
  <span
    v-if="disabled"
    :class="[
      inline ? 'inline-flex' : 'flex',
      sizeClass,
      {
        'opacity-50 gap-x-1 items-center justify-center font-mono border border-transparent rounded-md':
          isButton,
        'bg-transparent text-fg': isButton,
      },
    ]"
    ><slot
  /></span>
  <NuxtLink
    v-else
    class="group/link gap-x-1 items-center"
    :class="[
      inline ? 'inline-flex' : 'flex',
      sizeClass,
      {
        'underline-offset-[0.2rem] underline decoration-1 decoration-fg/30':
          !isLinkAnchor && isLink && !noUnderline,
        'justify-start font-mono text-fg hover:(decoration-accent text-accent) focus-visible:(decoration-accent text-accent) transition-colors duration-200':
          isLink,
        'justify-center font-mono border border-border rounded-md transition-all duration-200':
          isButton,
        'bg-transparent text-fg hover:(bg-fg/10 text-accent) focus-visible:(bg-fg/10 text-accent) aria-[current=true]:(bg-fg/10 text-accent border-fg/20 hover:enabled:(bg-fg/20 text-fg/50))':
          isButton,
      },
    ]"
    :to="to"
    :aria-keyshortcuts="ariaKeyshortcuts"
    :target="isLinkExternal ? '_blank' : undefined"
  >
    <span v-if="classicon" class="size-[1em]" :class="classicon" aria-hidden="true" />
    <slot />
    <!-- automatically show icon indicating external link -->
    <span
      v-if="isLinkExternal && !classicon"
      class="i-carbon:launch rtl-flip size-[1em] opacity-50"
      aria-hidden="true"
    />
    <span
      v-else-if="isLinkAnchor && isLink"
      class="i-carbon:link size-[1em] opacity-0 group-hover/link:opacity-100 transition-opacity duration-200"
      aria-hidden="true"
    />
    <kbd
      v-if="ariaKeyshortcuts"
      class="ms-2 inline-flex items-center justify-center size-4 text-xs text-fg bg-bg-muted border border-border rounded no-underline"
      aria-hidden="true"
    >
      {{ ariaKeyshortcuts }}
    </kbd>
  </NuxtLink>
</template>
