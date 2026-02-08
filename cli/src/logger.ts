import { styleText } from 'node:util'
import * as p from '@clack/prompts'
import { createDebug } from 'obug'

let isInitialized = false

/**
 * Initialize the logger with intro message
 */
export function initLogger(): void {
  if (isInitialized) return
  isInitialized = true
  p.intro(styleText(['bgCyan', 'black'], ' npmx connector '))
}

/**
 * Log when starting to execute a command
 */
export function logCommand(command: string): void {
  p.log.step(`${styleText('dim', '$ ')}${styleText('cyan', command)}`)
}

/**
 * Log successful command completion
 */
export function logSuccess(message: string): void {
  p.log.success(styleText('green', message))
}

/**
 * Log command failure
 */
export function logError(message: string): void {
  p.log.error(styleText('red', message))
}

/**
 * Log warning
 */
export function logWarning(message: string): void {
  p.log.warn(styleText('yellow', message))
}

/**
 * Log info message
 */
export function logInfo(message: string): void {
  p.log.info(message)
}

/**
 * Log a debug message with `obug` (minimal fork of `debug`)
 */
export const logDebug = createDebug('npmx-connector')

/**
 * Show the connection token in a nice box
 */
export function showToken(token: string, port: number, frontendUrl: string): void {
  const connectUrl = `${frontendUrl}?token=${token}&port=${port}`

  p.note(
    [
      `Open: ${styleText(['bold', 'underline', 'cyan'], connectUrl)}`,
      '',
      styleText('dim', `Or paste token manually: ${token}`),
    ].join('\n'),
    'Click to connect',
  )
}
