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
    event.key.toLowerCase() === key.toLowerCase() &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  )
}
