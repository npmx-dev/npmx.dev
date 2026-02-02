import type { CSSEntries, DynamicMatcher, Preset, RuleContext } from 'unocss'
import { cornerMap, directionSize, h } from '@unocss/preset-wind4/utils'

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
    const defaultMap = { l: 'is', r: 'ie' }
    const map = prefixMap || defaultMap
    const replacement = map[direction as 'l' | 'r']
    // oxlint-disable-next-line no-console -- warn logging
    console.warn(
      `[RTL] Avoid using '${match}'. Use '${match.replace(direction === 'l' ? 'l' : 'r', replacement)}' instead.`,
    )
    return matcher([match, replacement, size], context)
  }
}

function handlerRounded(
  [, a = '', s = 'DEFAULT']: string[],
  { theme }: RuleContext<any>,
): CSSEntries | undefined {
  if (a in cornerMap) {
    if (s === 'full') return cornerMap[a].map(i => [`border${i}-radius`, 'calc(infinity * 1px)'])

    const _v = theme.radius?.[s] ?? h.bracket.cssvar.global.fraction.rem(s)
    if (_v != null) {
      return cornerMap[a].map(i => [`border${i}-radius`, _v])
    }
  }
}

function handlerBorderSize([, a = '', b = '1']: string[]): CSSEntries | undefined {
  const v = h.bracket.cssvar.global.px(b)
  if (a in directionMap && v != null) return directionMap[a].map(i => [`border${i}-width`, v])
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
          const replacement = direction === 'left' ? 'inset-is' : 'inset-ie'
          // oxlint-disable-next-line no-console -- warn logging
          console.warn(
            `[RTL] Avoid using '${direction}-${size}'. Use '${replacement}-${size}' instead.`,
          )
          return directionSize('inset')(['', direction === 'left' ? 'is' : 'ie', size], context)
        },
        { autocomplete: '(left|right)-<num>' },
      ],
      [
        /^text-(left|right)$/,
        ([, direction]) => {
          const replacement = direction === 'left' ? 'start' : 'end'
          // oxlint-disable-next-line no-console -- warn logging
          console.warn(`[RTL] Avoid using 'text-${direction}'. Use 'text-${replacement}' instead.`)
          return { 'text-align': replacement }
        },
        { autocomplete: 'text-(left|right)' },
      ],
      [
        /^rounded-([rl])(?:-(.+))?$/,
        (args, context) => {
          const [_, direction, size] = args
          const replacementMap: Record<string, string> = {
            l: 'is',
            r: 'ie',
          }
          const replacement = replacementMap[direction]
          // oxlint-disable-next-line no-console -- warn logging
          console.warn(
            `[RTL] Avoid using 'rounded-${direction}'. Use 'rounded-${replacement}' instead.`,
          )
          return handlerRounded(['', replacement, size], context)
        },
      ],
      [
        /^border-([rl])(?:-(.+))?$/,
        args => {
          const [_, direction, size] = args
          const replacement = direction === 'l' ? 'is' : 'ie'
          // oxlint-disable-next-line no-console -- warn logging
          console.warn(
            `[RTL] Avoid using 'border-${direction}'. Use 'border-${replacement}' instead.`,
          )
          return handlerBorderSize(['', replacement, size || '1'])
        },
      ],
    ],
  }
}
