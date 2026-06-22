import { useCallback, useEffect, useState } from 'react'

// Lightweight client-side cooldown for throttling repeated email requests
// (resend confirmation, forgot-password resend). Purely a UX guard for a single
// browser tab — it complements, and never replaces, Supabase's server-side rate
// limiting. Call `start()` after a successful request; `remaining` counts down
// to 0 and `active` is true while the cooldown is running.
export function useCooldown(seconds = 60) {
  const [remaining, setRemaining] = useState(0)

  const start = useCallback(() => setRemaining(seconds), [seconds])

  useEffect(() => {
    if (remaining <= 0) return
    const timer = window.setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [remaining])

  return { remaining, active: remaining > 0, start }
}
