import type { CSSEntries, DynamicMatcher, Preset, RuleContext } from 'unocss'
import { cornerMap, directionSize, h } from '@unocss/preset-wind4/utils'

// Track warnings to avoid duplicates
const warnedClasses = new Set<string>()

function warnOnce(message: string, key: string) {
  if (!warnedClasses.has(key)) {
    warnedClasses.add(key)
    // oxlint-disable-next-line no-console -- warn logging
    console.warn(message)
  }
}

/** Reset warning state (for testing) */
export function resetRtlWarnings() {
  warnedClasses.clear()
}

const directionMap: Record<string, string[]> = {
  'l': ['-left'],
  'r': ['-right'],
  't': ['-top'],
  'b': ['-bottom'],
  's': ['-inline-start'],
  'e': ['-inline-end'],
  'x': ['-left', '-right'],
  'y': ['-top', '-bottom'],
  '': [''],
  'bs': ['-block-start'],
  'be': ['-block-end'],
  'is': ['-inline-start'],
  'ie': ['-inline-end'],
  'block': ['-block-start', '-block-end'],
  'inline': ['-inline-start', '-inline-end'],
}

function directionSizeRTL(
  propertyPrefix: string,
  prefixMap?: { l: string; r: string },
): DynamicMatcher {
  const matcher = directionSize(propertyPrefix)
  return (args, context) => {
    const [match, direction, size] = args
    if (!size) return undefined
    const defaultMap = { l: 'is', r: 'ie' }
    const map = prefixMap || defaultMap
    const replacement = map[direction as 'l' | 'r']
    warnOnce(
      `[RTL] Avoid using '${match}'. Use '${match.replace(direction === 'l' ? 'l' : 'r', replacement)}' instead.`,
      match,
    )
    return matcher([match, replacement, size], context)
  }
}

function handlerRounded(
  [, a = '', s = 'DEFAULT']: string[],
  { theme }: RuleContext<any>,
): CSSEntries | undefined {
  const corners = cornerMap[a]
  if (!corners) return undefined

  if (s === 'full') return corners.map(i => [`border${i}-radius`, 'calc(infinity * 1px)'])

  const _v = theme.radius?.[s] ?? h.bracket?.cssvar?.global?.fraction?.rem?.(s)
  if (_v != null) {
    return corners.map(i => [`border${i}-radius`, _v])
  }
}

function handlerBorderSize([, a = '', b = '1']: string[]): CSSEntries | undefined {
  const v = h.bracket?.cssvar?.global?.px?.(b)
  const directions = directionMap[a]
  if (directions && v != null) return directions.map(i => [`border${i}-width`, v])
}

/**
 * CSS RTL support to detect, replace and warn wrong left/right usages.
 */
export function presetRtl(): Preset {
  return {
    name: 'rtl-preset',
    rules: [
      // RTL overrides
      // We need to move the dash out of the capturing group to avoid capturing it in the direction
      [
        /^p([rl])-(.+)?$/,
        directionSizeRTL('padding', { l: 's', r: 'e' }),
        { autocomplete: '(m|p)<directions>-<num>' },
      ],
      [
        /^m([rl])-(.+)?$/,
        directionSizeRTL('margin', { l: 's', r: 'e' }),
        { autocomplete: '(m|p)<directions>-<num>' },
      ],
      [
        /^(?:position-|pos-)?(left|right)-(.+)$/,
        ([, direction, size], context) => {
          if (!size) return undefined
          const replacement = direction === 'left' ? 'inset-is' : 'inset-ie'
          warnOnce(
            `[RTL] Avoid using '${direction}-${size}'. Use '${replacement}-${size}' instead.`,
            `${direction}-${size}`,
          )
          return directionSize('inset')(['', direction === 'left' ? 'is' : 'ie', size], context)
        },
        { autocomplete: '(left|right)-<num>' },
      ],
      [
        /^text-(left|right)$/,
        ([, direction]) => {
          const replacement = direction === 'left' ? 'start' : 'end'
          warnOnce(
            `[RTL] Avoid using 'text-${direction}'. Use 'text-${replacement}' instead.`,
            `text-${direction}`,
          )
          return { 'text-align': replacement }
        },
        { autocomplete: 'text-(left|right)' },
      ],
      [
        /^rounded-([rl])(?:-(.+))?$/,
        (args, context) => {
          const [_, direction, size] = args
          if (!direction) return undefined
          const replacementMap: Record<string, string> = {
            l: 'is',
            r: 'ie',
          }
          const replacement = replacementMap[direction]
          if (!replacement) return undefined
          warnOnce(
            `[RTL] Avoid using 'rounded-${direction}'. Use 'rounded-${replacement}' instead.`,
            `rounded-${direction}`,
          )
          return handlerRounded(['', replacement, size ?? 'DEFAULT'], context)
        },
      ],
      [
        /^border-([rl])(?:-(.+))?$/,
        args => {
          const [_, direction, size] = args
          const replacement = direction === 'l' ? 'is' : 'ie'
          warnOnce(
            `[RTL] Avoid using 'border-${direction}'. Use 'border-${replacement}' instead.`,
            `border-${direction}`,
          )
          return handlerBorderSize(['', replacement, size || '1'])
        },
      ],
    ],
  }
}
