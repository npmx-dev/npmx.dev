<script setup lang="ts">
import type { Role } from '#server/api/contributors.get'

const router = useRouter()
const canGoBack = useCanGoBack()

useSeoMeta({
  title: () => `${$t('about.title')} - npmx`,
  ogTitle: () => `${$t('about.title')} - npmx`,
  twitterTitle: () => `${$t('about.title')} - npmx`,
  description: () => $t('about.meta_description'),
  ogDescription: () => $t('about.meta_description'),
  twitterDescription: () => $t('about.meta_description'),
})

defineOgImageComponent('Default', {
  primaryColor: '#60a5fa',
  title: 'about npmx',
  description: 'a fast, modern browser for the **npm registry**',
})

const pmLinks = {
  npm: 'https://www.npmjs.com/',
  pnpm: 'https://pnpm.io/',
  yarn: 'https://yarnpkg.com/',
  bun: 'https://bun.sh/',
  deno: 'https://deno.com/',
  vlt: 'https://www.vlt.sh/',
}

const { data: contributors, status: contributorsStatus } = useLazyFetch('/api/contributors')

const governanceMembers = computed(
  () => contributors.value?.filter(c => c.role !== 'contributor') ?? [],
)

const communityContributors = computed(
  () => contributors.value?.filter(c => c.role === 'contributor') ?? [],
)

const roleLabels = computed(
  () =>
    ({
      steward: $t('about.team.role_steward'),
      maintainer: $t('about.team.role_maintainer'),
    }) as Partial<Record<Role, string>>,
)
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('about.heading') }}
          </h1>
          <button
            type="button"
            class="cursor-pointer inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70 shrink-0"
            @click="router.back()"
            v-if="canGoBack"
          >
            <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
            <span class="hidden sm:inline">{{ $t('nav.back') }}</span>
          </button>
        </div>
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
                <LinkBase to="https://jsr.io/">JSR</LinkBase>
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
                    <LinkBase :to="pmLinks.npm" class="font-sans">{{
                      $t('about.what_we_are_not.words.people')
                    }}</LinkBase>
                  </template>
                  <template #building>
                    <LinkBase :to="pmLinks.pnpm" class="font-sans">{{
                      $t('about.what_we_are_not.words.building')
                    }}</LinkBase>
                  </template>
                  <template #really>
                    <LinkBase :to="pmLinks.yarn" class="font-sans">{{
                      $t('about.what_we_are_not.words.really')
                    }}</LinkBase>
                  </template>
                  <template #cool>
                    <LinkBase :to="pmLinks.bun" class="font-sans">{{
                      $t('about.what_we_are_not.words.cool')
                    }}</LinkBase>
                  </template>
                  <template #package>
                    <LinkBase :to="pmLinks.deno" class="font-sans">{{
                      $t('about.what_we_are_not.words.package')
                    }}</LinkBase>
                  </template>
                  <template #managers>
                    <LinkBase :to="pmLinks.vlt" class="font-sans">{{
                      $t('about.what_we_are_not.words.managers')
                    }}</LinkBase>
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
            {{ $t('about.team.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-6">
            {{ $t('about.contributors.description') }}
          </p>

          <!-- Governance: stewards + maintainers -->
          <section
            v-if="governanceMembers.length"
            class="mb-12"
            aria-labelledby="governance-heading"
          >
            <h3
              id="governance-heading"
              class="text-sm text-fg-subtle uppercase tracking-wider mb-4"
            >
              {{ $t('about.team.governance') }}
            </h3>

            <ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 list-none p-0">
              <li
                v-for="person in governanceMembers"
                :key="person.id"
                class="relative flex items-center gap-3 p-3 border border-border rounded-lg hover:border-border-hover hover:bg-bg-muted transition-[border-color,background-color] duration-200 cursor-pointer focus-within:ring-2 focus-within:ring-offset-bg focus-within:ring-offset-2 focus-within:ring-fg/50"
              >
                <img
                  :src="`${person.avatar_url}&s=80`"
                  :alt="`${person.login}'s avatar`"
                  class="w-12 h-12 rounded-md ring-1 ring-border shrink-0"
                  loading="lazy"
                />
                <div class="min-w-0 flex-1">
                  <div class="font-mono text-sm text-fg truncate">
                    <NuxtLink
                      :to="person.html_url"
                      target="_blank"
                      class="decoration-none after:content-[''] after:absolute after:inset-0"
                      :aria-label="$t('about.contributors.view_profile', { name: person.login })"
                    >
                      @{{ person.login }}
                    </NuxtLink>
                  </div>
                  <div class="text-xs text-fg-muted tracking-tight">
                    {{ roleLabels[person.role] ?? person.role }}
                  </div>
                  <LinkBase
                    v-if="person.sponsors_url"
                    :to="person.sponsors_url"
                    no-underline
                    no-external-icon
                    classicon="i-lucide:heart"
                    class="relative z-10 text-xs text-fg-muted hover:text-pink-400 mt-0.5"
                    :aria-label="$t('about.team.sponsor_aria', { name: person.login })"
                  >
                    {{ $t('about.team.sponsor') }}
                  </LinkBase>
                </div>
                <span
                  class="i-lucide:external-link rtl-flip w-3.5 h-3.5 text-fg-muted opacity-50 shrink-0 self-start mt-0.5"
                  aria-hidden="true"
                />
              </li>
            </ul>
          </section>

          <!-- Contributors cloud -->
          <section aria-labelledby="contributors-heading">
            <h3
              id="contributors-heading"
              class="text-sm text-fg-subtle uppercase tracking-wider mb-4"
            >
              {{
                $t(
                  'about.contributors.title',
                  { count: $n(communityContributors.length) },
                  communityContributors.length,
                )
              }}
            </h3>

            <div
              v-if="contributorsStatus === 'pending'"
              class="text-fg-subtle text-sm"
              role="status"
            >
              {{ $t('about.contributors.loading') }}
            </div>
            <div
              v-else-if="contributorsStatus === 'error'"
              class="text-fg-subtle text-sm"
              role="alert"
            >
              {{ $t('about.contributors.error') }}
            </div>
            <ul
              v-else-if="communityContributors.length"
              class="grid grid-cols-[repeat(auto-fill,48px)] justify-center gap-2 list-none p-0"
            >
              <li
                v-for="contributor in communityContributors"
                :key="contributor.id"
                class="group relative"
              >
                <LinkBase
                  :to="contributor.html_url"
                  no-underline
                  no-external-icon
                  :aria-label="$t('about.contributors.view_profile', { name: contributor.login })"
                >
                  <img
                    :src="`${contributor.avatar_url}&s=64`"
                    :alt="`${contributor.login}'s avatar`"
                    width="48"
                    height="48"
                    class="w-12 h-12 rounded-lg ring-2 ring-transparent group-hover:ring-accent transition-all duration-200 ease-out hover:scale-125 will-change-transform"
                    loading="lazy"
                  />
                  <span
                    class="pointer-events-none absolute -top-9 inset-is-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-xs px-2 py-1 shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100"
                    dir="ltr"
                    role="tooltip"
                  >
                    @{{ contributor.login }}
                  </span>
                </LinkBase>
              </li>
            </ul>
          </section>
        </div>

        <CallToAction />
      </section>
    </article>
  </main>
</template>
