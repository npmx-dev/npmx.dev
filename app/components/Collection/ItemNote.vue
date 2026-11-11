<template>
  <!-- Styled as a code comment: the familiar way to annotate the thing beside it -->
  <p class="m-0 min-w-0 font-mono text-xs sm:text-sm font-normal text-fg-muted break-words">
    <span class="text-fg-subtle select-none" aria-hidden="true">//&nbsp;</span>
    <span class="sr-only">{{ $t('collections.note_label') }}</span>
    <slot />
  </p>
</template>
