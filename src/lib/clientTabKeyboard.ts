import type { KeyboardEvent } from 'react'

/** Manual tab activation: focus never loads a panel or changes selection. */
export function moveClientTabFocus<Key extends string>(
  event: Pick<KeyboardEvent<HTMLButtonElement>, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'preventDefault'>,
  index: number,
  selected: Key,
  keys: readonly Key[],
  buttons: Partial<Record<Key, HTMLButtonElement | null>>,
) {
  if (event.altKey || event.ctrlKey || event.metaKey || !keys.length
    || !Number.isInteger(index) || index < 0 || index >= keys.length) return
  if (event.key === 'Tab') {
    // Native Tab/Shift+Tab must leave the whole tab list, including when an
    // inactive tab on either side of the selection has received arrow focus.
    buttons[selected]?.focus()
    return
  }
  const next = event.key === 'ArrowRight' ? (index + 1) % keys.length
    : event.key === 'ArrowLeft' ? (index + keys.length - 1) % keys.length
      : event.key === 'Home' ? 0
        : event.key === 'End' ? keys.length - 1 : null
  if (next === null) return
  event.preventDefault()
  buttons[keys[next]]?.focus()
}
