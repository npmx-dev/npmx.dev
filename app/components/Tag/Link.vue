<script setup lang="ts">
import type { NuxtLinkProps } from '#app'

const { current, ...props } = defineProps<
  {
    /** Disabled links will be displayed as plain text */
    disabled?: boolean
    /**
     * `type` should never be used, because this will always be a link.
     *
     * If you want a button use `TagButton` instead.
     * */
    type?: never
    current?: boolean
  } &
    /** This makes sure the link always has either `to` or `href` */
    (Required<Pick<NuxtLinkProps, 'to'>> | Required<Pick<NuxtLinkProps, 'href'>>) &
    NuxtLinkProps
>()
</script>

<template>
  <span v-if="disabled" class="opacity-50"><slot /></span>
  <NuxtLink
    v-else
    class="inline-flex items-center px-2 py-0.5 text-xs font-mono border rounded transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
    :class="{
      'bg-bg-muted text-fg-muted border-border hover:(text-fg border-border-hover)': !current,
      'bg-fg text-bg border-fg hover:(text-text-bg/50)': current,
      'opacity-50 cursor-not-allowed': disabled,
    }"
    v-bind="props"
  >
    <slot />
  </NuxtLink>
</template>
