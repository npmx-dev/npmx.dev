<script setup lang="ts">
interface GitHubContributor {
  login: string
  id: number
  avatar_url: string
  html_url: string
  contributions: number
}

useSeoMeta({
  title: () => `${$t('about.title')} - npmx`,
  description: () => $t('about.meta_description'),
})

defineOgImageComponent('Default', {
  primaryColor: '#60a5fa',
  title: 'About npmx',
  description: 'A better browser for the **npm registry**',
})

const pmLinks = {
  npm: 'https://www.npmjs.com/',
  pnpm: 'https://pnpm.io/',
  yarn: 'https://yarnpkg.com/',
  bun: 'https://bun.sh/',
  deno: 'https://deno.com/',
  vlt: 'https://www.vlt.sh/',
}

const { data: contributors, status: contributorsStatus } = useFetch<GitHubContributor[]>(
  '/api/contributors',
  {
    lazy: true,
  },
)
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <h1 class="font-mono text-3xl sm:text-4xl font-medium mb-4">{{ $t('about.heading') }}</h1>
        <p class="text-fg-muted text-lg">
          {{ $t('tagline') }}
        </p>
      </header>

      <section class="prose prose-invert max-w-none space-y-8">
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('about.what_we_are.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="about.what_we_are.description" tag="span" scope="global">
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
            <i18n-t keypath="about.what_we_are.admin_description" tag="span" scope="global">
              <template #adminUi>
                <strong class="text-fg">{{ $t('about.what_we_are.admin_ui') }}</strong>
              </template>
            </i18n-t>
          </p>
        </div>

        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
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
                <i18n-t
                  keypath="about.what_we_are_not.package_managers_exist"
                  tag="span"
                  scope="global"
                >
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
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{
              $t(
                'about.contributors.title',
                { count: $n(contributors?.length ?? 0) },
                contributors?.length ?? 0,
              )
            }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-6">
            {{ $t('about.contributors.description') }}
          </p>

          <!-- Contributors cloud -->
          <div v-if="contributorsStatus === 'pending'" class="text-fg-subtle text-sm">
            {{ $t('about.contributors.loading') }}
          </div>
          <div v-else-if="contributorsStatus === 'error'" class="text-fg-subtle text-sm">
            {{ $t('about.contributors.error') }}
          </div>
          <div v-else-if="contributors?.length" class="flex flex-wrap gap-2">
            <a
              v-for="contributor in contributors"
              :key="contributor.id"
              :href="contributor.html_url"
              target="_blank"
              rel="noopener noreferrer"
              class="group relative"
              :aria-label="$t('about.contributors.view_profile', { name: contributor.login })"
            >
              <div class="relative flex items-center">
                <img
                  :src="`${contributor.avatar_url}&s=64`"
                  :alt="contributor.login"
                  width="32"
                  height="32"
                  class="w-12 h-12 rounded-lg ring-2 ring-transparent group-hover:ring-accent transition-all duration-200 ease-out hover:scale-125 will-change-transform"
                  loading="lazy"
                />
                <span
                  class="pointer-events-none absolute -top-9 inset-is-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-xs px-2 py-1 shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100"
                >
                  @{{ contributor.login }}
                </span>
              </div>
            </a>
          </div>
        </div>

        <CallToAction />
      </section>

      <footer class="mt-16 pt-8 border-t border-border">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-[color] duration-200 rounded focus-visible:outline-accent/70"
        >
          <span class="i-carbon:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
          {{ $t('about.back_home') }}
        </NuxtLink>
      </footer>
    </article>
  </main>
</template>
