import {
  defineConfig,
  presetIcons,
  presetWind4,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import type { Theme } from '@unocss/preset-wind4/theme'
import { presetRtl } from './uno-preset-rtl'

const customIcons = {
  'agent-skills':
    '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 0.5L29.4234 8.25V23.75L16 31.5L2.57661 23.75V8.25L16 0.5Z" fill="currentColor"/><path d="M16 6L24.6603 11V21L16 26L7.33975 21V11L16 6Z" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  'tangled':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25"><path fill="currentColor" d="M16.346 24.11c-.785-.007-1.384-.235-2.034-.632-.932-.49-1.643-1.314-2.152-2.222-.808 1.003-1.888 1.611-3.097 1.955-.515.15-1.416.301-2.911-.24-2.154-.724-3.723-2.965-3.545-5.25-.033-.946.313-1.875.802-2.674-1.305-.7-2.37-1.876-2.777-3.318-.248-.79-.237-1.64-.146-2.452.327-1.916 1.764-3.582 3.615-4.182.738-1.683 2.35-2.938 4.176-3.193a5.54 5.54 0 0 1 3.528.7C13.351.89 16.043.383 18.1 1.436c1.568.75 2.69 2.312 2.962 4.015 1.492.598 2.749 1.817 3.242 3.365.33.958.34 2.013.127 2.997-.382 1.536-1.465 2.842-2.868 3.557.003.273.901 2.243.751 3.73-.033 1.858-1.211 3.62-2.846 4.475-.954.557-2.085.546-3.12.535m-4.47-5.35c1.322-.148 2.19-1.3 2.862-2.339.319-.473.562-1.002.803-1.506.314.287.58.828 1.075.957.522.163 1.133.03 1.453-.443.611-1.14.31-2.517-.046-3.699-.22-.679-.507-1.375-1.054-1.856.116-.823-.372-1.66-1.065-2.09-.592.47-1.491.468-2.061-.037-1.093 1.115-2.095 1.078-3.063.195-.217-.199-.632 1.212-2.088.413-.837.7-1.485 1.375-2.06 2.346-.559 1.046-1.143 1.976-1.194 3.113-.024.664.495 1.36 1.198 1.306.703.063 1.182-.63 1.714-.917.08.928.169 1.924.482 2.829.36 1.171 1.627 1.916 2.825 1.745zm.687-3.498c-.644-.394-.334-1.25-.36-1.871.064-.75.115-1.538.453-2.221.356-.487 1.226-.3 1.265.326-.026.628-.314 1.254-.28 1.905-.075.544.054 1.155-.186 1.653-.198.275-.6.355-.892.208m-2.81-.358c-.605-.329-.413-1.156-.508-1.73.08-.666.014-1.51.571-1.978.545-.38 1.287.271 1.03.869-.276.755-.096 1.58-.09 2.346a.712.712 0 0 1-1.002.493"/></svg>',
  'vlt':
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.9991 5.03666C7.9991 5.46387 7.93211 5.87545 7.80808 6.26145C7.45933 7.34674 7.1975 8.58253 7.7669 9.57009L10.389 14.1177C10.7072 14.6697 11.3617 14.9108 11.9989 14.9108V14.9108V14.9108C12.6352 14.9108 13.2886 14.6699 13.6064 14.1187L16.2301 9.5682C16.7993 8.58097 16.5379 7.34565 16.1895 6.26064C16.0656 5.87488 15.9987 5.46358 15.9987 5.03666C15.9987 2.82777 17.7894 1.03711 19.9983 1.03711C22.2071 1.03711 23.9978 2.82777 23.9978 5.03666C23.9978 7.24555 22.2071 9.03621 19.9983 9.03621V9.03621C19.3609 9.03621 18.7062 9.27733 18.3878 9.82951L15.7661 14.3766C15.1967 15.3642 15.4586 16.6001 15.8074 17.6854C15.9314 18.0715 15.9984 18.4831 15.9984 18.9104C15.9984 21.1193 14.2078 22.9099 11.9989 22.9099C9.79001 22.9099 7.99935 21.1193 7.99935 18.9104C7.99935 18.4834 8.06626 18.072 8.19016 17.6862C8.53863 16.6012 8.80017 15.3657 8.23092 14.3785L5.60752 9.8285C5.28961 9.27712 4.63601 9.03621 3.99955 9.03621V9.03621C1.79066 9.03621 0 7.24555 0 5.03666C0 2.82777 1.79066 1.03711 3.99955 1.03711C6.20844 1.03711 7.9991 2.82777 7.9991 5.03666Z" fill="currentColor"></path></svg>',
}

export default defineConfig({
  presets: [
    presetWind4(),
    presetIcons({
      extraProperties: {
        display: 'inline-block',
      },
      warn: true,
      scale: 1.2,
      collections: {
        custom: customIcons,
      },
    }),
    // keep this preset last
    ...(process.env.CI ? [] : [presetRtl()]),
  ].filter(Boolean),
  transformers: [transformerDirectives(), transformerVariantGroup()],
  theme: {
    font: {
      mono: "'Geist Mono', monospace",
      sans: "'Geist', system-ui, -apple-system, sans-serif",
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
  } satisfies Theme,
  shortcuts: [
    // Layout
    ['container', 'max-w-6xl mx-auto px-4 sm:px-6'],
    ['container-sm', 'max-w-5xl mx-auto px-4 sm:px-6'],

    // Focus states - subtle but accessible
    ['focus-ring', 'outline-none focus-visible:(ring-2 ring-fg/50 ring-offset-2)'],

    // Buttons
    [
      'btn',
      'inline-flex items-center justify-center px-4 py-2 font-mono text-sm border border-border rounded-md bg-transparent text-fg transition-all duration-200 hover:(bg-fg hover:text-bg border-fg) focus-ring active:scale-98 disabled:(opacity-40 cursor-not-allowed hover:bg-transparent hover:text-fg)',
    ],
    [
      'btn-ghost',
      'inline-flex items-center justify-center px-3 py-1.5 font-mono text-sm text-fg-muted bg-transparent transition-all duration-200 hover:text-fg focus-ring',
    ],

    // Links
    [
      'link',
      'text-fg underline-offset-4 decoration-border hover:(decoration-fg underline) transition-colors duration-200 focus-ring',
    ],
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
