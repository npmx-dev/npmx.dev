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
  title: 'npmx brand',
  description: 'logos, colors, typography, and usage guidelines',
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
  {
    name: () => $t('brand.logos.app_icon'),
    src: '/logo-icon.svg',
    altDark: () => $t('brand.logos.app_icon_alt'),
    altLight: () => $t('brand.logos.app_icon_light_alt'),
    width: 512,
    height: 512,
    span: false,
  },
]

const colors = [
  { key: 'background', hex: '#0a0a0a', oklch: 'oklch(0.171 0 0)', swatch: '#0a0a0a', light: false },
  { key: 'foreground', hex: '#fafafa', oklch: 'oklch(0.982 0 0)', swatch: '#fafafa', light: true },
  {
    key: 'accent',
    hex: '#51c8fc',
    oklch: 'oklch(0.787 0.128 230.318)',
    swatch: '#51c8fc',
    light: true,
  },
]

const { copy, copied, text: lastCopied } = useClipboard({ copiedDuring: 2000 })

const typographySizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm']

const dosItems = [
  () => $t('brand.usage.do_clear_space'),
  () => $t('brand.usage.do_color_variants'),
  () => $t('brand.usage.do_aspect_ratio'),
  () => $t('brand.usage.do_minimum_size'),
]

const dontsItems = [
  () => $t('brand.usage.dont_stretch'),
  () => $t('brand.usage.dont_recolor'),
  () => $t('brand.usage.dont_busy_bg'),
  () => $t('brand.usage.dont_effects'),
  () => $t('brand.usage.dont_rotate'),
]

const pngLoading = ref<string | null>(null)

async function handlePngDownload(logo: (typeof logos)[number]) {
  pngLoading.value = logo.src
  try {
    const blob = await convert(logo.src, logo.width, logo.height)
    const filename = logo.src.replace(/^\//, '').replace('.svg', '.png')
    downloadPng(blob, filename)
  } finally {
    pngLoading.value = null
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
                    :disabled="pngLoading === logo.src"
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

        <!-- Colors Section -->
        <section aria-labelledby="brand-colors-heading">
          <h2 id="brand-colors-heading" class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('brand.colors.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-8">
            {{ $t('brand.colors.description') }}
          </p>

          <!-- Screen reader announcement for copy -->
          <div class="sr-only" aria-live="polite" role="status">
            <span v-if="copied">{{ $t('brand.colors.copied') }}</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div
              v-for="color in colors"
              :key="color.key"
              class="group"
              role="group"
              :aria-label="$t(`brand.colors.${color.key}`)"
            >
              <div
                class="rounded-lg h-20 sm:h-24 mb-3 border border-border"
                :style="{ backgroundColor: color.hex }"
              />
              <p class="font-mono text-sm text-fg mb-1 m-0">
                {{ $t(`brand.colors.${color.key}`) }}
              </p>
              <div class="flex flex-col gap-1">
                <ButtonBase
                  size="sm"
                  class="!border-none !px-0 !justify-start"
                  :aria-label="
                    $t('brand.colors.copy_hex', { name: $t(`brand.colors.${color.key}`) })
                  "
                  @click="copy(color.hex)"
                >
                  <code class="text-fg-muted">{{ color.hex }}</code>
                  <span
                    class="w-3 h-3 shrink-0 transition-colors duration-200"
                    :class="
                      copied && lastCopied === color.hex
                        ? 'i-lucide:check text-badge-green'
                        : 'i-lucide:copy opacity-0 group-hover:opacity-100'
                    "
                    aria-hidden="true"
                  />
                </ButtonBase>
                <ButtonBase
                  size="sm"
                  class="!border-none !px-0 !justify-start"
                  :aria-label="
                    $t('brand.colors.copy_oklch', { name: $t(`brand.colors.${color.key}`) })
                  "
                  @click="copy(color.oklch)"
                >
                  <code class="text-fg-subtle">{{ color.oklch }}</code>
                  <span
                    class="w-3 h-3 shrink-0 transition-colors duration-200"
                    :class="
                      copied && lastCopied === color.oklch
                        ? 'i-lucide:check text-badge-green'
                        : 'i-lucide:copy opacity-0 group-hover:opacity-100'
                    "
                    aria-hidden="true"
                  />
                </ButtonBase>
              </div>
            </div>
          </div>
        </section>

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

        <!-- Usage Guidelines Section -->
        <section aria-labelledby="brand-usage-heading">
          <h2 id="brand-usage-heading" class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('brand.usage.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-8">
            {{ $t('brand.usage.description') }}
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Do's -->
            <div>
              <h3 class="font-mono text-sm text-badge-green uppercase tracking-wider mb-4">
                {{ $t('brand.usage.do') }}
              </h3>
              <ul class="space-y-3 list-none p-0 m-0">
                <li
                  v-for="(item, i) in dosItems"
                  :key="`do-${i}`"
                  class="flex items-start gap-3 text-fg-muted text-sm"
                >
                  <span
                    class="i-lucide:check w-4 h-4 text-badge-green shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{{ item() }}</span>
                </li>
              </ul>
            </div>

            <!-- Don'ts -->
            <div>
              <h3 class="font-mono text-sm text-badge-pink uppercase tracking-wider mb-4">
                {{ $t('brand.usage.dont') }}
              </h3>
              <ul class="space-y-3 list-none p-0 m-0">
                <li
                  v-for="(item, i) in dontsItems"
                  :key="`dont-${i}`"
                  class="flex items-start gap-3 text-fg-muted text-sm"
                >
                  <span
                    class="i-lucide:x w-4 h-4 text-badge-pink shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{{ item() }}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </article>
  </main>
</template>
