import type { Theme } from '@unocss/preset-wind4/theme'

export const theme = {
  spacing: { DEFAULT: '4px' },
  font: {
    mono: "'Geist Mono', 'IBM Plex Sans Arabic', monospace",
    sans: "'Geist', 'IBM Plex Sans Arabic', system-ui, -apple-system, sans-serif",
  },
  text: {
    '2xs': { fontSize: '0.6875rem' }, // 11px
    '3xs': { fontSize: '0.625rem' }, // 10px
    '4xs': { fontSize: '0.5625rem' }, // 9px
    '5xs': { fontSize: '0.5rem' }, // 8px
  },
  colors: {
    // Minimal black & white palette with subtle grays
    bg: {
      DEFAULT: 'var(--bg)',
      subtle: 'var(--bg-subtle)',
      muted: 'var(--bg-muted)',
      elevated: 'var(--bg-elevated)',
    },
    fg: {
      DEFAULT: 'var(--fg)',
      muted: 'var(--fg-muted)',
      subtle: 'var(--fg-subtle)',
    },
    border: {
      DEFAULT: 'var(--border)',
      subtle: 'var(--border-subtle)',
      hover: 'var(--border-hover)',
    },
    accent: {
      DEFAULT: 'var(--accent)',
      fallback: 'var(--accent-muted)',
    },
    // Syntax highlighting colors (inspired by GitHub Dark)
    syntax: {
      fn: 'var(--syntax-fn)',
      str: 'var(--syntax-str)',
      kw: 'var(--syntax-kw)',
      comment: 'var(--syntax-comment)',
    },
    badge: {
      orange: 'var(--badge-orange)',
      yellow: 'var(--badge-yellow)',
      green: 'var(--badge-green)',
      cyan: 'var(--badge-cyan)',
      blue: 'var(--badge-blue)',
      indigo: 'var(--badge-indigo)',
      purple: 'var(--badge-purple)',
      pink: 'var(--badge-pink)',
    },
    // Playground provider brand colors
    provider: {
      stackblitz: '#1389FD',
      codesandbox: '#FFCC00',
      codepen: '#47CF73',
      replit: '#F26207',
      gitpod: '#FFAE33',
      vue: '#4FC08D',
      nuxt: '#00DC82',
      vite: '#646CFF',
      jsfiddle: '#0084FF',
      typescript: '#3178C6',
      solid: '#2C4F7C',
      svelte: '#FF3E00',
      tailwind: '#06B6D4',
      storybook: '#FF4785',
      marko: '#CC0067',
    },
  },
  animation: {
    keyframes: {
      'skeleton-pulse': '{0%, 100% { opacity: 0.4 } 50% { opacity: 0.7 }}',
      'fade-in': '{from { opacity: 0 } to { opacity: 1 }}',
      'slide-up':
        '{from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) }}',
      'scale-in':
        '{from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) }}',
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
} satisfies Theme
