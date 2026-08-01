import { useEffect, useState } from 'react'

// iOS/Android do not resize the layout viewport when the on-screen keyboard
// opens, so fixed bars (drawer save bars) can end up hidden under the keyboard.
// Track visualViewport to return the inset needed to keep a fixed footer above
// the keyboard. Returns 0 on desktop / when unsupported.
export function useVisualViewportBottomInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let active = true
    const update = () => {
      if (!active) return
      const keyboardSpace = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0))
      setInset(keyboardSpace)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      active = false
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}
