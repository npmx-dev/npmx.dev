import { RGBA } from '@opentui/core'
import type { Theme } from '../types.ts'

export const darkTheme: Theme = {
  bg: {
    base: RGBA.defaultBackground(),
    surface: '#202124',
    elevated: '#282A2E',
    selected: '#30343A',
  },
  fg: {
    primary: RGBA.defaultForeground(),
    secondary: '#B8BCC4',
    muted: '#737982',
  },
  border: {
    normal: '#454A52',
    subtle: '#34383F',
    focused: '#7AA2F7',
  },
  status: {
    success: '#8EC07C',
    warning: '#E5C07B',
    danger: '#E06C75',
    info: '#61AFEF',
  },
  accent: '#7AA2F7',
}
