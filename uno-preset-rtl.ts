import type { CSSEntries, DynamicMatcher, Preset, RuleContext } from 'unocss'
import { cornerMap, directionSize, h } from '@unocss/preset-wind4/utils'

export type CollectorChecker = (warning: string, rule: string) => void

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
  checker?: CollectorChecker,
): DynamicMatcher {
  const matcher = directionSize(propertyPrefix)
  return ([match, direction, size], context) => {
    if (!size) return undefined
    const defaultMap = { l: 'is', r: 'ie' }
    const map = prefixMap || defaultMap
    const replacement = map[direction as 'l' | 'r']

    const fullClass = context.rawSelector || match
    const prefix = match.substring(0, 1) // 'p' or 'm'
    const suggestedBase = match.replace(`${prefix}${direction!}`, `${prefix}${replacement}`)
    const suggestedClass = fullClass.replace(match, suggestedBase)

    if (checker) {
      checker(`avoid using '${fullClass}', use '${suggestedClass}' instead.`, fullClass)
    } else {
      warnOnce(`[RTL] Avoid using '${fullClass}'. Use '${suggestedClass}' instead.`, fullClass)
    }
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
export function presetRtl(checker?: CollectorChecker): Preset {
  return {
    name: 'rtl-preset',
    rules: [
      // RTL overrides
      // We need to move the dash out of the capturing group to avoid capturing it in the direction
      [
        /^p([rl])-(.+)?$/,
        directionSizeRTL('padding', { l: 's', r: 'e' }, checker),
        { autocomplete: '(m|p)<directions>-<num>' },
      ],
      [
        /^m([rl])-(.+)?$/,
        directionSizeRTL('margin', { l: 's', r: 'e' }, checker),
        { autocomplete: '(m|p)<directions>-<num>' },
      ],
      [
        /^(?:position-|pos-)?(left|right)-(.+)$/,
        ([match, direction, size], context) => {
          if (!size) return undefined
          const replacement = direction === 'left' ? 'inset-is' : 'inset-ie'

          const fullClass = context.rawSelector || match
          // match is 'left-4' or 'position-left-4'
          // replacement is 'inset-is' or 'inset-ie'
          // We want 'inset-is-4'
          const suggestedBase = `${replacement}-${size}`
          const suggestedClass = fullClass.replace(match, suggestedBase)

          if (checker) {
            checker(`avoid using '${fullClass}', use '${suggestedClass}' instead.`, fullClass)
          } else {
            warnOnce(
              `[RTL] Avoid using '${fullClass}'. Use '${suggestedClass}' instead.`,
              fullClass,
            )
          }
          return directionSize('inset')(['', direction === 'left' ? 'is' : 'ie', size], context)
        },
        { autocomplete: '(left|right)-<num>' },
      ],
      [
        /^text-(left|right)$/,
        ([match, direction], context) => {
          const replacement = direction === 'left' ? 'start' : 'end'

          const fullClass = context.rawSelector || match
          const suggestedBase = match.replace(`text-${direction!}`, `text-${replacement}`)
          const suggestedClass = fullClass.replace(match, suggestedBase)

          if (checker) {
            checker(`avoid using '${fullClass}', use '${suggestedClass}' instead.`, fullClass)
          } else {
            warnOnce(
              `[RTL] Avoid using '${fullClass}'. Use '${suggestedClass}' instead.`,
              fullClass,
            )
          }
          return { 'text-align': replacement }
        },
        { autocomplete: 'text-(left|right)' },
      ],
      [
        /^rounded-([rl])(?:-(.+))?$/,
        ([match, direction, size], context) => {
          if (!direction) return undefined
          const replacementMap: Record<string, string> = {
            l: 'is',
            r: 'ie',
          }
          const replacement = replacementMap[direction]
          if (!replacement) return undefined

          const fullClass = context.rawSelector || match
          const suggestedBase = match.replace(`rounded-${direction!}`, `rounded-${replacement}`)
          const suggestedClass = fullClass.replace(match, suggestedBase)

          if (checker) {
            checker(`avoid using '${fullClass}', use '${suggestedClass}' instead.`, fullClass)
          } else {
            warnOnce(
              `[RTL] Avoid using '${fullClass}'. Use '${suggestedClass}' instead.`,
              fullClass,
            )
          }
          return handlerRounded(['', replacement, size ?? 'DEFAULT'], context)
        },
      ],
      [
        /^border-([rl])(?:-(.+))?$/,
        ([match, direction, size], context) => {
          const replacement = direction === 'l' ? 'is' : 'ie'

          const fullClass = context.rawSelector || match
          const suggestedBase = match.replace(`border-${direction!}`, `border-${replacement}`)
          const suggestedClass = fullClass.replace(match, suggestedBase)

          if (checker) {
            checker(`avoid using '${fullClass}', use '${suggestedClass}' instead.`, fullClass)
          } else {
            warnOnce(
              `[RTL] Avoid using '${fullClass}'. Use '${suggestedClass}' instead.`,
              fullClass,
            )
          }
          return handlerBorderSize(['', replacement, size || '1'])
        },
      ],
    ],
  }
}
