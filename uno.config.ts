import process from 'node:process'
import {
  defineConfig,
  presetIcons,
  presetTypography,
  presetWind4,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import { presetRtl } from './uno-preset-rtl'
import { presetA11y } from './uno-preset-a11y'
import { theme } from './uno.theme'
import customIcons from './assets/media/custom-icons.json'

export default defineConfig({
  // og-image uses hardcoded classes we don't want bundled into main app
  content: {
    pipeline: {
      exclude: [
        // Preserve the UnoCSS defaults that @unocss/nuxt normally sets
        /\.(css|postcss|sass|scss|less|stylus|styl)($|\?)/,
        /\?macro=true/,
        // Exclude OG image templates from the pipeline
        '**/OgImage/*.takumi.vue',
      ],
      include: [
        /\.(vue|mdx|html)($|\?)/,
        // git provider icons composable
        '**/composables/useProviderIcon.ts',
      ],
    },
  },
  presets: [
    presetWind4(),
    presetIcons({
      extraProperties: {
        'display': 'inline-block',
        'forced-color-adjust': 'preserve-parent-color',
      },
      warn: true,
      scale: 1.2,
      collections: {
        custom: Object.fromEntries(
          Object.entries(customIcons).map(([key, { body }]) => [key, body]),
        ),
      },
    }),
    presetTypography(),
    // keep this preset last
    ...(process.env.CI ? [] : [presetRtl(), presetA11y()]),
  ].filter(Boolean),
  transformers: [transformerDirectives({ enforce: 'pre' }), transformerVariantGroup()],
  theme,
  shortcuts: [
    // Layout
    ['container', 'max-w-6xl mx-auto px-4 sm:px-6'],
    ['container-sm', 'max-w-5xl mx-auto px-4 sm:px-6'],
    ['flex-split', 'flex items-center justify-between'],

    // Focus states - subtle but accessible
    ['focus-ring', 'outline-none focus-visible:(ring-2 ring-fg/50 ring-offset-2)'],

    ['link-subtle', 'text-fg-muted hover:text-fg transition-colors duration-200 focus-ring'],

    // badges
    ['badge-orange', 'bg-badge-orange/10 text-badge-orange'],
    ['badge-yellow', 'bg-badge-yellow/10 text-badge-yellow'],
    ['badge-green', 'bg-badge-green/10 text-badge-green'],
    ['badge-cyan', 'bg-badge-cyan/10 text-badge-cyan'],
    ['badge-blue', 'bg-badge-blue/10 text-badge-blue'],
    ['badge-indigo', 'bg-badge-indigo/10 text-badge-indigo'],
    ['badge-purple', 'bg-badge-purple/10 text-badge-purple'],
    ['badge-pink', 'bg-badge-pink/10 text-badge-pink'],
    ['badge-subtle', 'bg-bg-subtle text-fg-subtle'],
    ['badge-accent', 'bg-accent/10 text-accent'],
  ],
  rules: [
    // Custom scale for active states
    ['scale-98', { transform: 'scale(0.98)' }],

    // Subtle text gradient for headings
    [
      'text-gradient',
      {
        'background': 'linear-gradient(to right, #fafafa, #a1a1a1)',
        '-webkit-background-clip': 'text',
        '-webkit-text-fill-color': 'transparent',
        'background-clip': 'text',
      },
    ],

    // Ensures elements start in initial state during delay
    ['animate-fill-both', { 'animation-fill-mode': 'both' }],
  ],
})
