<script setup lang="ts">
useSeoMeta({
  title: () => `${$t('brand.title')} - npmx`,
  ogTitle: () => `${$t('brand.title')} - npmx`,
  twitterTitle: () => `${$t('brand.title')} - npmx`,
  description: () => $t('brand.meta_description'),
  ogDescription: () => $t('brand.meta_description'),
  twitterDescription: () => $t('brand.meta_description'),
})

defineOgImageComponent('Default', {
  primaryColor: '#51c8fc',
  title: $t('brand.title'),
  description: $t('brand.meta_description'),
})

const { convert, download: downloadPng } = useSvgToPng()

const logos = [
  {
    name: () => $t('brand.logos.wordmark'),
    src: '/logo.svg',
    altDark: () => $t('brand.logos.wordmark_alt'),
    altLight: () => $t('brand.logos.wordmark_light_alt'),
    width: 602,
    height: 170,
    span: true,
  },
  {
    name: () => $t('brand.logos.mark'),
    src: '/logo-mark.svg',
    altDark: () => $t('brand.logos.mark_alt'),
    altLight: () => $t('brand.logos.mark_light_alt'),
    width: 153,
    height: 153,
    span: false,
  },
]

const typographySizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm']

const pngLoading = ref(new Set<string>())

async function handlePngDownload(logo: (typeof logos)[number]) {
  if (pngLoading.value.has(logo.src)) return
  pngLoading.value.add(logo.src)
  try {
    const blob = await convert(logo.src, logo.width, logo.height)
    const filename = logo.src.replace(/^\//, '').replace('.svg', '.png')
    downloadPng(blob, filename)
  } finally {
    pngLoading.value.delete(logo.src)
  }
}
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-4xl mx-auto">
      <!-- Header -->
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('brand.heading') }}
          </h1>
          <BackButton />
        </div>
        <p class="text-fg-muted text-lg">
          {{ $t('brand.intro') }}
        </p>
      </header>

      <div class="space-y-16">
        <!-- Logos Section -->
        <section aria-labelledby="brand-logos-heading">
          <h2 id="brand-logos-heading" class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('brand.logos.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-8">
            {{ $t('brand.logos.description') }}
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <figure
              v-for="logo in logos"
              :key="logo.src"
              class="m-0"
              :class="{ 'md:col-span-2': logo.span }"
              role="group"
              :aria-label="logo.name()"
            >
              <div class="grid grid-cols-2 gap-3 mb-3">
                <!-- Dark background preview -->
                <div
                  class="bg-[#0a0a0a] rounded-lg p-6 sm:p-8 flex items-center justify-center border border-border min-h-32"
                >
                  <img
                    :src="logo.src"
                    :alt="logo.altDark()"
                    class="max-h-16 w-auto max-w-full"
                    :class="{ 'max-h-20': logo.span }"
                  />
                </div>
                <!-- Light background preview -->
                <div
                  class="bg-white rounded-lg p-6 sm:p-8 flex items-center justify-center border border-border min-h-32"
                >
                  <AppLogo
                    v-if="logo.src === '/logo.svg'"
                    class="max-h-20 w-auto max-w-full text-[#0a0a0a]"
                    :aria-label="logo.altLight()"
                  />
                  <img
                    v-else
                    :src="logo.src"
                    :alt="logo.altLight()"
                    class="max-h-16 w-auto max-w-full"
                    :style="logo.src === '/logo-mark.svg' ? 'filter: invert(1)' : ''"
                  />
                </div>
              </div>

              <figcaption class="flex items-center justify-between gap-3">
                <span class="font-mono text-sm text-fg">{{ logo.name() }}</span>
                <div class="flex items-center gap-2">
                  <a
                    :href="logo.src"
                    :download="logo.src.replace('/', '')"
                    class="inline-flex items-center gap-1 text-xs font-mono text-fg-muted border border-border rounded-md px-2.5 py-1 hover:bg-bg-muted hover:text-fg transition-colors duration-200 no-underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    :aria-label="$t('brand.logos.download_svg_aria', { name: logo.name() })"
                  >
                    <span class="i-lucide:download w-3.5 h-3.5" aria-hidden="true" />
                    {{ $t('brand.logos.download_svg') }}
                  </a>
                  <ButtonBase
                    size="sm"
                    classicon="i-lucide:download"
                    :aria-label="$t('brand.logos.download_png_aria', { name: logo.name() })"
                    :disabled="pngLoading.has(logo.src)"
                    @click="handlePngDownload(logo)"
                  >
                    {{ $t('brand.logos.download_png') }}
                  </ButtonBase>
                </div>
              </figcaption>
            </figure>
          </div>
        </section>

        <!-- Customize Section (client-only: needs DOM for accent colors + canvas export) -->
        <ClientOnly>
          <BrandCustomize />
        </ClientOnly>

        <!-- Typography Section -->
        <section aria-labelledby="brand-typography-heading">
          <h2 id="brand-typography-heading" class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('brand.typography.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-8">
            {{ $t('brand.typography.description') }}
          </p>

          <div class="space-y-10">
            <!-- Geist Sans -->
            <div>
              <h3 class="font-mono text-sm text-fg uppercase tracking-wider mb-1">
                {{ $t('brand.typography.sans') }}
              </h3>
              <p class="text-fg-subtle text-sm mb-4 m-0">
                {{ $t('brand.typography.sans_desc') }}
              </p>
              <div class="space-y-2 border border-border rounded-lg p-6">
                <p
                  v-for="size in typographySizes"
                  :key="`sans-${size}`"
                  class="font-sans text-fg m-0"
                  :class="size"
                >
                  {{ $t('brand.typography.pangram') }}
                </p>
                <p class="font-sans text-fg text-lg m-0 mt-4 tracking-widest">
                  {{ $t('brand.typography.numbers') }}
                </p>
              </div>
            </div>

            <!-- Geist Mono -->
            <div>
              <h3 class="font-mono text-sm text-fg uppercase tracking-wider mb-1">
                {{ $t('brand.typography.mono') }}
              </h3>
              <p class="text-fg-subtle text-sm mb-4 m-0">
                {{ $t('brand.typography.mono_desc') }}
              </p>
              <div class="space-y-2 border border-border rounded-lg p-6">
                <p
                  v-for="size in typographySizes"
                  :key="`mono-${size}`"
                  class="font-mono text-fg m-0"
                  :class="size"
                >
                  {{ $t('brand.typography.pangram') }}
                </p>
                <p class="font-mono text-fg text-lg m-0 mt-4 tracking-widest">
                  {{ $t('brand.typography.numbers') }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Guidelines -->
        <section aria-labelledby="brand-guidelines-heading">
          <h2 id="brand-guidelines-heading" class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('brand.guidelines.title') }}
          </h2>
          <blockquote
            class="border-is-2 border-is-accent ps-6 py-2 text-fg-muted leading-relaxed italic"
          >
            {{ $t('brand.guidelines.message') }}
          </blockquote>
        </section>
      </div>
    </article>
  </main>
</template>
