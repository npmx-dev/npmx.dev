import type { KeyEvent } from '@opentui/core'
import type { AppState } from './types.ts'

export function isPlainKey(key: KeyEvent, name: string): boolean {
  return (
    key.eventType === 'press' &&
    key.name.toLowerCase() === name &&
    !key.ctrl &&
    !key.meta &&
    !key.option
  )
}

export function isCtrlKey(key: KeyEvent, name: string): boolean {
  return (
    key.eventType === 'press' &&
    key.name.toLowerCase() === name &&
    key.ctrl &&
    !key.meta &&
    !key.option
  )
}

export function shouldQuit(key: KeyEvent, state: AppState): boolean {
  return state.focus !== 'search' && isPlainKey(key, 'q')
}
