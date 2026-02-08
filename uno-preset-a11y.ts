import type { Preset } from 'unocss'

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
export function resetA11yWarnings() {
  warnedClasses.clear()
}

const textPxToClass: Record<number, string> = {
  11: 'text-2xs',
  10: 'text-3xs',
  9: 'text-4xs',
  8: 'text-5xs',
}

function reportTextSizeWarning(match: string, suggestion: string, checker?: CollectorChecker) {
  const message = `[A11y] Avoid using '${match}', ${suggestion}.`
  if (checker) {
    checker(message, match)
  } else {
    warnOnce(message, match)
  }
}

export function presetA11y(checker?: CollectorChecker): Preset {
  return {
    name: 'a11y-preset',
    // text-[N] (arbitrary where N is a size in px or em): recommend text-2xs/text-3xs/text-4xs/text-5xs or "use classes"
    rules: [
      [
        /^text-\[(\d+(\.\d+)?)(px)?\]$/,
        ([match, numStr], context) => {
          const num = Number(numStr)
          const fullClass = context.rawSelector || match
          const suggestedClass = textPxToClass[num]
          if (suggestedClass) {
            reportTextSizeWarning(fullClass, `use '${suggestedClass}' instead`, checker)
          } else {
            reportTextSizeWarning(
              fullClass,
              'use text-<size> classes or rem values instead of custom values',
              checker,
            )
          }
          return [['font-size', `${num}px`]]
        },
        { autocomplete: 'text-[<num>]' },
      ],
      [
        /^text-\[(\d+(\.\d+)?)em\]$/,
        ([match, numStr], context) => {
          const num = Number(numStr)
          const fullClass = context.rawSelector || match
          reportTextSizeWarning(
            fullClass,
            'use text-<size> classes or rem values instead of custom values',
            checker,
          )
          return [['font-size', `${num}em`]]
        },
        { autocomplete: 'text-[<num>]em' },
      ],
    ],
  }
}
