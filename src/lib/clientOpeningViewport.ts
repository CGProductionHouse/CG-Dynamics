// iOS can retain input-focus magnification when an SPA enters the portal.
// Layout widths still report the whole phone while visualViewport shows only
// a cropped part. Repair that opening state once, never on section navigation
// or later pinch gestures. No permanent zoom restriction is installed.
export function restoreClientOpeningViewport(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  if (!ios || !window.matchMedia('(max-width: 767px)').matches) return () => {}
  const viewport = window.visualViewport
  if (!viewport || !Number.isFinite(viewport.scale) || viewport.scale <= 1.01) return () => {}
  const active = document.activeElement
  if (active instanceof HTMLElement && (active.matches('input, select, textarea') || active.isContentEditable)) return () => {}
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  const original = meta?.getAttribute('content')
  if (!meta || !original) return () => {}

  let frame = 0
  let timer = 0
  let restored = false
  // Preserve the document's original viewport, including user zoom support.
  // A timeout also restores it in background tabs where rAF may be suspended.
  const restore = () => {
    if (restored) return
    restored = true
    window.cancelAnimationFrame(frame)
    window.clearTimeout(timer)
    meta.setAttribute('content', original)
    window.removeEventListener('touchstart', onTouch)
  }
  const onTouch = () => restore()
  window.addEventListener('touchstart', onTouch, { passive: true, once: true })
  timer = window.setTimeout(restore, 250)
  meta.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1')
  frame = window.requestAnimationFrame(() => {
    frame = window.requestAnimationFrame(restore)
  })
  return restore
}
