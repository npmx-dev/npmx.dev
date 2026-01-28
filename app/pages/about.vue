<script setup lang="ts">
useSeoMeta({
  title: () => `${$t('about.title')} - npmx`,
  description: () => $t('about.meta_description'),
})

defineOgImageComponent('Default', {
  title: () => $t('about.title'),
  description: () => $t('tagline'),
})

const pmLinks = {
  npm: 'https://www.npmjs.com/',
  pnpm: 'https://pnpm.io/',
  yarn: 'https://yarnpkg.com/',
  bun: 'https://bun.sh/',
  deno: 'https://deno.com/',
  vlt: 'https://www.vlt.sh/',
}
</script>

<template>
  <main class="container py-12 sm:py-16 min-h-screen">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <h1 class="font-mono text-3xl sm:text-4xl font-medium mb-4">{{ $t('about.heading') }}</h1>
        <p class="text-fg-muted text-lg">
          {{ $t('tagline') }}
        </p>
      </header>

      <section class="prose prose-invert max-w-none space-y-8">
        <div>
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('about.what_we_are.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="about.what_we_are.description" tag="span">
              <template #betterUxDx>
                <strong class="text-fg">{{ $t('about.what_we_are.better_ux_dx') }}</strong>
              </template>
              <template #jsr>
                <a
                  href="https://jsr.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link text-fg"
                  >JSR</a
                >
              </template>
            </i18n-t>
          </p>
          <p class="text-fg-muted leading-relaxed">
            <i18n-t keypath="about.what_we_are.admin_description" tag="span">
              <template #adminUi>
                <strong class="text-fg">{{ $t('about.what_we_are.admin_ui') }}</strong>
              </template>
            </i18n-t>
          </p>
        </div>

        <div>
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('about.what_we_are_not.title') }}
          </h2>
          <ul class="space-y-3 text-fg-muted list-none p-0">
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>
                <strong class="text-fg">{{
                  $t('about.what_we_are_not.not_package_manager')
                }}</strong>
                {{ ' ' }}
                <i18n-t keypath="about.what_we_are_not.package_managers_exist" tag="span">
                  <template #already>{{ $t('about.what_we_are_not.words.already') }}</template>
                  <template #people>
                    <a
                      :href="pmLinks.npm"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                      >{{ $t('about.what_we_are_not.words.people') }}</a
                    >
                  </template>
                  <template #building>
                    <a
                      :href="pmLinks.pnpm"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                      >{{ $t('about.what_we_are_not.words.building') }}</a
                    >
                  </template>
                  <template #really>
                    <a
                      :href="pmLinks.yarn"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                      >{{ $t('about.what_we_are_not.words.really') }}</a
                    >
                  </template>
                  <template #cool>
                    <a
                      :href="pmLinks.bun"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                      >{{ $t('about.what_we_are_not.words.cool') }}</a
                    >
                  </template>
                  <template #package>
                    <a
                      :href="pmLinks.deno"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                      >{{ $t('about.what_we_are_not.words.package') }}</a
                    >
                  </template>
                  <template #managers>
                    <a
                      :href="pmLinks.vlt"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                      >{{ $t('about.what_we_are_not.words.managers') }}</a
                    >
                  </template>
                </i18n-t>
              </span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>
                <strong class="text-fg">{{ $t('about.what_we_are_not.not_registry') }}</strong>
                {{ $t('about.what_we_are_not.registry_description') }}
              </span>
            </li>
          </ul>
        </div>

        <div>
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('about.vision.title') }}
          </h2>
          <ul class="space-y-3 text-fg-muted list-none p-0">
            <li class="flex items-start gap-3">
              <span class="text-accent shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-current" />
              <span>
                <strong class="text-fg">{{ $t('about.vision.speed_first') }}</strong> &mdash;
                {{ $t('about.vision.speed_first_description') }}
              </span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-accent shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-current" />
              <span>
                <strong class="text-fg">{{ $t('about.vision.url_compatible') }}</strong> &mdash;
                <i18n-t keypath="about.vision.url_compatible_description" tag="span">
                  <template #npmjs>
                    <code class="text-sm bg-bg-subtle px-1.5 py-0.5 rounded">npmjs.com</code>
                  </template>
                  <template #npmx>
                    <code class="text-sm bg-bg-subtle px-1.5 py-0.5 rounded">npmx.dev</code>
                  </template>
                </i18n-t>
              </span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-accent shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-current" />
              <span>
                <strong class="text-fg">{{ $t('about.vision.simplicity') }}</strong> &mdash;
                {{ $t('about.vision.simplicity_description') }}
              </span>
            </li>
          </ul>
        </div>

        <div>
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('about.open_source.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed">
            <i18n-t keypath="about.open_source.description" tag="span">
              <template #github>
                <a
                  href="https://repo.npmx.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link text-fg"
                  >{{ $t('about.open_source.github') }}</a
                >
              </template>
              <template #discord>
                <a
                  href="https://chat.npmx.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link text-fg"
                  >{{ $t('about.open_source.discord') }}</a
                >
              </template>
              <template #bluesky>
                <a
                  href="https://social.npmx.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link text-fg"
                  >{{ $t('about.open_source.bluesky') }}</a
                >
              </template>
            </i18n-t>
          </p>
        </div>
      </section>

      <footer class="mt-16 pt-8 border-t border-border">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-[color] duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        >
          <span class="i-carbon-arrow-left w-4 h-4" aria-hidden="true" />
          {{ $t('about.back_home') }}
        </NuxtLink>
      </footer>
    </article>
  </main>
</template>
