export const noCorrect = {
  autocapitalize: 'off',
  autocomplete: 'off',
  autocorrect: 'off',
  spellcheck: 'false',
} as const

/**
 * Check if an event target is an editable element (input, textarea, or contenteditable).
 * Useful for keyboard shortcut handlers that should not trigger when the user is typing.
 */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

/**
 * Check if a keyboard event matches a specific key without any modifier keys.
 */
export function isKeyWithoutModifiers(event: KeyboardEvent, key: string): boolean {
  return (
    event.key?.toLowerCase() === key.toLowerCase() &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  )
}

export const DATE_INPUT_MAX = '9999-12-31'

/** Attributes to prevent password managers from recognizing an input as a password field. */
export const noPasswordManager = {
  /* ProtonPass, https://stackoverflow.com/a/51272839 */
  ['data-protonpass-ignore']: 'true',
  /* LastPass, https://stackoverflow.com/a/51272839 */
  ['data-lpignore']: 'true',
  /* 1Password, https://stackoverflow.com/a/51272839 */
  ['data-1p-ignore']: 'true',
  /* Bitwarden, https://stackoverflow.com/questions/41945535/html-disable-password-manager#comment139327111_51272839 */
  ['data-bwignore']: 'true',
} as const
