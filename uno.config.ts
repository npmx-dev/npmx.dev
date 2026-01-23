import { defineConfig, presetIcons, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'
import type { Theme } from '@unocss/preset-wind4/theme'

export default defineConfig({
  presets: [
    presetWind4(),
    presetIcons({
      scale: 1.2,
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  theme: {
    font: {
      mono: '\'Geist Mono\', monospace',
      sans: '\'Geist\', system-ui, -apple-system, sans-serif',
    },
    colors: {
      // Minimal black & white palette with subtle grays
      bg: {
        DEFAULT: '#0a0a0a',
        subtle: '#111111',
        muted: '#1a1a1a',
        elevated: '#222222',
      },
      fg: {
        DEFAULT: '#fafafa',
        muted: '#a1a1a1',
        subtle: '#666666',
      },
      border: {
        DEFAULT: '#262626',
        subtle: '#1f1f1f',
        hover: '#404040',
      },
      accent: {
        DEFAULT: '#ffffff',
        muted: '#e5e5e5',
      },
      // Syntax highlighting colors (inspired by GitHub Dark)
      syntax: {
        fn: '#b392f0', // function/command - purple
        str: '#9ecbff', // string/argument - light blue
        kw: '#f97583', // keyword - red/pink
        comment: '#6a737d', // comment - gray
      },
    },
    animation: {
      keyframes: {
        'skeleton-pulse': '{0%, 100% { opacity: 0.4 } 50% { opacity: 0.7 }}',
        'fade-in': '{from { opacity: 0 } to { opacity: 1 }}',
        'slide-up': '{from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) }}',
        'scale-in': '{from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) }}',
      },
      durations: {
        'skeleton-pulse': '2s',
        'fade-in': '0.3s',
        'slide-up': '0.4s',
        'scale-in': '0.2s',
      },
      timingFns: {
        'skeleton-pulse': 'ease-in-out',
        'fade-in': 'ease-out',
        'slide-up': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      counts: {
        'skeleton-pulse': 'infinite',
      },
    },
  } satisfies Theme,
  shortcuts: [
    // Layout
    ['container', 'max-w-4xl mx-auto px-4 sm:px-6'],

    // Focus states - subtle but accessible
    ['focus-ring', 'outline-none focus-visible:(ring-2 ring-fg/20 ring-offset-2 ring-offset-bg)'],

    // Buttons
    ['btn', 'inline-flex items-center justify-center px-4 py-2 font-mono text-sm border border-border rounded-md bg-transparent text-fg transition-all duration-200 hover:(bg-fg hover:text-bg border-fg) focus-ring active:scale-98 disabled:(opacity-40 cursor-not-allowed hover:bg-transparent hover:text-fg)'],
    ['btn-ghost', 'inline-flex items-center justify-center px-3 py-1.5 font-mono text-sm text-fg-muted bg-transparent transition-all duration-200 hover:text-fg focus-ring'],

    // Links
    ['link', 'text-fg underline-offset-4 decoration-border hover:(decoration-fg underline) transition-colors duration-200 focus-ring'],
    ['link-subtle', 'text-fg-muted hover:text-fg transition-colors duration-200 focus-ring'],

    // Cards
    ['card', 'bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 transition-all duration-200'],
    ['card-interactive', 'card hover:(border-border-hover bg-bg-muted) cursor-pointer'],

    // Form elements
    ['input-base', 'w-full bg-bg-subtle border border-border rounded-md px-4 py-3 font-mono text-sm text-fg placeholder:text-fg-subtle transition-all duration-200 focus:(border-fg/40 outline-none ring-1 ring-fg/10)'],

    // Tags/badges
    ['tag', 'inline-flex items-center px-2 py-0.5 text-xs font-mono text-fg-muted bg-bg-muted border border-border rounded transition-colors duration-200 hover:(text-fg border-border-hover)'],

    // Code blocks
    ['code-block', 'bg-bg-muted border border-border rounded-md p-4 font-mono text-sm overflow-x-auto'],

    // Skeleton loading
    ['skeleton', 'bg-bg-elevated rounded animate-skeleton-pulse'],

    // Subtle divider
    ['divider', 'border-t border-border'],

    // Section spacing
    ['section', 'py-8 sm:py-12'],
  ],
  rules: [
    // Custom scale for active states
    ['scale-98', { transform: 'scale(0.98)' }],

    // Subtle text gradient for headings
    ['text-gradient', {
      'background': 'linear-gradient(to right, #fafafa, #a1a1a1)',
      '-webkit-background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
      'background-clip': 'text',
    }],

    // Ensures elements start in initial state during delay
    ['animate-fill-both', { 'animation-fill-mode': 'both' }],
  ],
})
