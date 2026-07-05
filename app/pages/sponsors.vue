<script setup lang="ts">
import { SPONSORS } from '~/assets/logos/sponsors'

const SPONSORSHIP_TIER_PRICES = {
  silver: 500,
  gold: 1000,
} as const

const { t } = useI18n()
const currencyFormatter = useNumberFormatter({
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function formatTierPrice(amount: number) {
  return `${currencyFormatter.value.format(amount)}${t('sponsors_page.tiers.per_month')}`
}

useSeoMeta({
  title: () => `${$t('sponsors_page.title')} - npmx`,
  ogTitle: () => `${$t('sponsors_page.title')} - npmx`,
  twitterTitle: () => `${$t('sponsors_page.title')} - npmx`,
  description: () => $t('sponsors_page.meta_description'),
  ogDescription: () => $t('sponsors_page.meta_description'),
  twitterDescription: () => $t('sponsors_page.meta_description'),
})

defineOgImage(
  'Page.takumi',
  {
    title: () => $t('sponsors_page.title'),
    description: () => $t('sponsors_page.meta_description'),
  },
  { alt: () => `${$t('sponsors_page.title')} — npmx` },
)
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16">
    <header class="mb-12">
      <div class="flex items-baseline justify-between gap-4 mb-4">
        <h1 class="font-mono text-3xl sm:text-4xl font-medium">
          {{ $t('sponsors_page.heading') }}
        </h1>
        <BackButton />
      </div>
      <p class="text-fg-muted text-lg leading-relaxed">
        {{ $t('sponsors_page.intro') }}
      </p>
    </header>

    <div class="space-y-12" :class="$style.grid">
      <section :class="$style.intro">
        <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
          {{ $t('sponsors_page.what_we_do.title') }}
        </h2>
        <p class="text-fg-muted leading-relaxed">
          {{ $t('sponsors_page.what_we_do.description') }}
        </p>
      </section>

      <aside :class="$style.sponsors">
        <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
          {{ $t('about.sponsors.title') }}
        </h2>
        <h3 class="block text-sm text-fg uppercase tracking-wider mb-3">
          {{ $t('about.sponsors.gold') }}
        </h3>
        <AboutLogoList
          :list="SPONSORS.gold"
          class="grid gap-3 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] lg:grid-cols-1"
        />
        <h3 class="block text-sm text-fg uppercase tracking-wider mb-3 mt-6">
          {{ $t('about.sponsors.silver') }}
        </h3>
        <AboutLogoList
          :list="SPONSORS.silver"
          class="grid gap-3 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] lg:grid-cols-1"
        />
      </aside>

      <section :class="$style.content">
        <div>
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('sponsors_page.what_this_means_for_you.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            {{ $t('sponsors_page.what_this_means_for_you.description') }}
          </p>
          <div class="grid gap-4 sm:grid-cols-12">
            <section class="border border-border bg-bg-elevated rounded-lg p-5 sm:col-span-7">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="font-mono text-2xl text-fg uppercase tracking-wider mb-2">250+</p>
                  <p class="text-fg-muted text-sm leading-relaxed m-0">
                    {{ $t('sponsors_page.what_this_means_for_you.cards.people.contributors') }}
                  </p>
                </div>
                <div>
                  <p class="font-mono text-2xl text-fg uppercase tracking-wider mb-2">700+</p>
                  <p class="text-fg-muted text-sm leading-relaxed m-0">
                    {{ $t('sponsors_page.what_this_means_for_you.cards.people.community_members') }}
                  </p>
                </div>
              </div>
            </section>
            <section class="border border-border rounded-lg p-5 bg-bg-subtle sm:col-span-5">
              <p class="font-mono text-2xl text-fg uppercase tracking-wider mb-2">200000+</p>
              <p class="text-fg-muted text-sm leading-relaxed m-0">
                {{ $t('sponsors_page.what_this_means_for_you.cards.visitors.description') }}
              </p>
            </section>
            <section class="border border-border rounded-lg p-5 bg-bg-subtle sm:col-span-4">
              <p class="font-mono text-2xl text-fg uppercase tracking-wider mb-2">3400+</p>
              <p class="text-fg-muted text-sm leading-relaxed m-0">
                {{ $t('sponsors_page.what_this_means_for_you.cards.stars.title') }}
              </p>
            </section>
            <section class="border border-border rounded-lg p-5 bg-bg-subtle sm:col-span-8">
              <p class="font-mono text-2xl text-fg uppercase tracking-wider mb-2">
                {{ $t('sponsors_page.what_this_means_for_you.cards.community.title') }}
              </p>
              <p class="text-fg-muted text-sm leading-relaxed m-0">
                {{ $t('sponsors_page.what_this_means_for_you.cards.community.description')
                }}<sup>*</sup>
              </p>
            </section>
            <section class="border border-border rounded-lg p-5 bg-bg-subtle sm:col-span-6">
              <p class="font-mono text-2xl text-fg uppercase tracking-wider mb-2">
                {{ $t('sponsors_page.what_this_means_for_you.cards.adoption.title') }}
              </p>
              <p class="text-fg-muted text-sm leading-relaxed m-0">
                {{ $t('sponsors_page.what_this_means_for_you.cards.adoption.description') }}
              </p>
            </section>
            <section class="border border-border rounded-lg p-5 bg-bg-subtle sm:col-span-6">
              <p class="font-mono text-2xl text-fg uppercase tracking-wider mb-2">
                {{ $t('sponsors_page.what_this_means_for_you.cards.default_source.title') }}
              </p>
              <p class="text-fg-muted text-sm leading-relaxed m-0">
                {{ $t('sponsors_page.what_this_means_for_you.cards.default_source.description') }}
              </p>
            </section>
          </div>
        </div>

        <div class="mt-6">
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('sponsors_page.what_support_means.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed">
            {{ $t('sponsors_page.what_support_means.description') }}
          </p>
        </div>

        <div class="mt-6">
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('sponsors_page.tiers.title') }}
          </h2>

          <div class="border border-fg/80 rounded-xl p-5 bg-bg-muted">
            <div class="flex items-center justify-between gap-3 mb-2">
              <h3 class="font-mono text-base text-fg uppercase tracking-wider">
                {{ $t('sponsors_page.tiers.silver.name') }}
              </h3>
              <span class="i-lucide:coins size-4 text-fg-subtle" aria-hidden="true" />
            </div>
            <p class="text-sm text-fg-subtle font-mono">
              {{ formatTierPrice(SPONSORSHIP_TIER_PRICES.silver) }}
            </p>
          </div>

          <div
            class="border border-badge-yellow/80 rounded-xl p-5 bg-linear-to-br from-badge-yellow/8 to-bg-subtle/40 relative overflow-hidden mt-4"
          >
            <div class="flex items-center justify-between gap-3 mb-2 relative">
              <h3 class="font-mono text-base text-fg uppercase tracking-wider">
                {{ $t('sponsors_page.tiers.gold.name') }}
              </h3>
              <span class="i-lucide:medal size-4 text-badge-yellow" aria-hidden="true" />
            </div>
            <p class="text-sm text-fg-subtle font-mono">
              {{ formatTierPrice(SPONSORSHIP_TIER_PRICES.gold) }}
            </p>
          </div>

          <div
            class="border border-badge-blue/80 rounded-xl p-5 bg-linear-to-br from-badge-blue/8 to-bg-subtle/40 relative overflow-hidden mt-4"
          >
            <div class="flex items-center justify-between gap-3 mb-2">
              <h3 class="font-mono text-base text-fg uppercase tracking-wider">
                {{ $t('sponsors_page.tiers.platinum.name') }}
              </h3>
              <span class="i-lucide:crown size-4 text-badge-blue" aria-hidden="true" />
            </div>
            <p class="text-sm text-fg-subtle font-mono">
              {{ $t('sponsors_page.tiers.custom') }}
            </p>
          </div>
        </div>
      </section>
    </div>

    <p class="text-fg-subtle text-xs leading-relaxed mt-12">
      <i18n-t keypath="sponsors_page.community_growth_footnote" tag="span" scope="global">
        <template #link>
          <LinkBase to="https://osscar.dev/"> OSSCAR </LinkBase>
        </template>
      </i18n-t>
    </p>
  </main>
</template>

<style module>
.grid {
  display: grid;
  column-gap: 2rem;
  row-gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'intro'
    'sponsors'
    'content';
}

@media (min-width: 64rem) {
  .grid {
    grid-template-columns: 1fr 20rem;
    grid-template-areas: 'intro sponsors' 'content sponsors';
  }
}

.grid > * {
  min-width: 0;
}

.intro {
  grid-area: intro;
}

.sponsors {
  grid-area: sponsors;
  align-self: start;
}

.content {
  grid-area: content;
}
</style>
