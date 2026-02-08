// matches ANSI escape sequences (colors, cursor movement, etc.)
// oxlint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*[a-z]/gi

/**
 * strips ANSI escape codes from a string.
 *
 * @param input string potentially containing ANSI codes
 * @returns string with ANSI codes removed
 */
export function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, '')
}
