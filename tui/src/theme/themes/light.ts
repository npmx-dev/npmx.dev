import { RGBA } from '@opentui/core'
import type { Theme } from '../types.ts'

export const lightTheme: Theme = {
  bg: {
    base: RGBA.defaultBackground(),
    surface: '#F3F4F6',
    elevated: '#FFFFFF',
    selected: '#E5E7EB',
  },
  fg: {
    primary: RGBA.defaultForeground(),
    secondary: '#4B5563',
    muted: '#8A9099',
  },
  border: {
    normal: '#C5C9D0',
    subtle: '#DFE2E7',
    focused: '#2563EB',
  },
  status: {
    success: '#2F855A',
    warning: '#B7791F',
    danger: '#C53030',
    info: '#2563EB',
  },
  accent: '#2563EB',
}
