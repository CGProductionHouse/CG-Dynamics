import { useCallback, useState } from 'react'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage unavailable (private browsing, etc.)
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore
  }
}

/**
 * Persists a draft value in localStorage, scoped by key.
 *
 * Usage:
 *   const { getInitialDraft, saveDraft, clearDraft, hasDraft } = useLocalDraft<MyType>(key)
 *   const [value, setValue] = useState(() => getInitialDraft() ?? defaultValue)
 *   // call saveDraft(value) on changes
 *   // call clearDraft() after successful submit
 */
export function useLocalDraft<T>(key: string) {
  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    try {
      return localStorage.getItem(key) !== null
    } catch {
      return false
    }
  })

  // Reads the stored draft once (synchronous, safe to call in useState initializers).
  function getInitialDraft(): T | null {
    return read<T>(key)
  }

  const saveDraft = useCallback(
    (value: T) => {
      write(key, value)
      setHasDraft(true)
    },
    [key]
  )

  const clearDraft = useCallback(() => {
    remove(key)
    setHasDraft(false)
  }, [key])

  return { getInitialDraft, saveDraft, clearDraft, hasDraft }
}
