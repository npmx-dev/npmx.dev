<template>
  <TooltipApp interactive position="top">
    <template #content>
      <p class="text-sm font-medium text-fg mb-1">
        A free press makes openness possible for everyone.
        <LinkBase to="https://en.wikipedia.org/wiki/World_Press_Freedom_Day"
          >Read more about Press Freedom Day</LinkBase
        >
      </p>
    </template>
    <ColorSchemeImg
      width="320"
      class="mb-16 w-80 sm:w-140 max-w-full"
      dark-src="/extra/npmx-dark-press.png"
      light-src="/extra/npmx-light-press.png"
      :alt="$t('alt_logo')"
    />
  </TooltipApp>
</template>
