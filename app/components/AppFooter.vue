<template>
  <footer class="border-t border-border mt-auto">
    <div class="container py-3 sm:py-8 flex flex-col gap-2 sm:gap-4 text-fg-subtle text-sm">
      <div class="flex flex-col sm:flex-row items-center sm:items-baseline justify-start gap-2 sm:gap-4">
        <p class="font-mono text-balance m-0 hidden sm:block">{{ $t('tagline') }}</p>
        <span aria-hidden="true" class="flex-shrink-1 flex-grow-1" />
        <div class="flex items-center justify-start gap-3 sm:gap-6">
          <NuxtLink
            to="/about"
            class="link-subtle font-mono text-xs min-h-8 sm:min-h-11 flex items-center"
          >
            <span>{{ $t('footer.about') }}</span>
          </NuxtLink>
          <a
            href="https://docs.npmx.dev"
            target="_blank"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-xs min-h-8 sm:min-h-11 flex items-center justify-start gap-1"
          >
            <span>{{ $t('footer.docs') }}</span>
            <span class="i-carbon:launch rtl-flip w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="https://repo.npmx.dev"
            target="_blank"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-xs min-h-8 sm:min-h-11 flex justify-start items-center gap-1"
          >
            <span>{{ $t('footer.source') }}</span>
            <span class="i-carbon:launch rtl-flip w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="https://social.npmx.dev"
            target="_blank"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-xs min-h-8 sm:min-h-11 flex items-center justify-start gap-1"
          >
            <span>{{ $t('footer.social') }}</span>
            <span class="i-carbon:launch rtl-flip w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="https://chat.npmx.dev"
            target="_blank"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-xs min-h-8 sm:min-h-11 flex items-center justify-start gap-1"
          >
            <span>{{ $t('footer.chat') }}</span>
            <span class="i-carbon:launch rtl-flip w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      </div>
      <p class="text-xs text-fg-muted text-center sm:text-start m-0">
        <span class="sm:hidden">{{ $t('non_affiliation_disclaimer') }}</span>
        <span class="hidden sm:inline">{{ $t('trademark_disclaimer') }}</span>
      </p>
    </div>
  </footer>
</template>
