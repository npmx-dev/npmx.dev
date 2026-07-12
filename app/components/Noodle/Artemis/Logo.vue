<template>
  <div class="relative w-80 sm:w-100 max-w-full">
    <ColorSchemeImg
      width="400"
      class="motion-safe:animate-fade-in motion-safe:animate-scale-in relative z-10 w-full"
      dark-src="/extra/npmx-dark-artemis.svg"
      light-src="/extra/npmx-light-artemis.svg"
      :alt="$t('alt_logo')"
    />
    <ColorSchemeImg
      width="1440"
      height="455"
      class="absolute -bottom-4 inset-is-0 w-full h-auto mix-blend-lighten light:mix-blend-darken motion-safe:animate-fade-in pointer-events-none select-none"
      dark-src="/extra/moon-dark.png"
      light-src="/extra/moon-light.png"
      alt=""
    />
  </div>
</template>
