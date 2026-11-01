type EmbedTheme = 'light' | 'dark'

export function resolveEmbedChartColors(theme: EmbedTheme = 'light') {
  // duplicated from main.css
  const palettes = {
    dark: {
      default: {
        bg: 'oklch(0.171 0 0)',
        bgSubtle: 'oklch(0.198 0 0)',
        bgMuted: 'oklch(0.236 0 0)',
        bgElevated: 'oklch(0.266 0 0)',
        fg: 'oklch(0.982 0 0)',
        fgMuted: 'oklch(0.749 0 0)',
        fgSubtle: 'oklch(0.673 0 0)',
        border: 'oklch(0.269 0 0)',
        accent: 'oklch(0.787 0.128 230.318)',
      },
    },
    light: {
      default: {
        bg: 'oklch(1 0 0)',
        bgSubtle: 'oklch(0.979 0.001 286.375)',
        bgMuted: 'oklch(0.955 0.001 286.76)',
        bgElevated: 'oklch(0.94 0.002 287.29)',
        fg: 'oklch(0.146 0 0)',
        fgMuted: 'oklch(0.398 0 0)',
        fgSubtle: 'oklch(0.48 0 0)',
        border: 'oklch(0.8514 0 0)',
        accent: 'oklch(0.5 0.16 247.27)',
      },
    },
  } as const

  return {
    ...palettes[theme].default,
  }
}
