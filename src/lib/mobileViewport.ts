import { useEffect, useState } from 'react'

// Mobile viewport primitives.
//
// iOS Safari does not resize the *layout* viewport when the on-screen keyboard
// opens — it only shrinks the *visual* viewport and scrolls the page. Anything
// laid out against `100vh`/`100dvh` therefore ends up partly under the keyboard,
// and `position: fixed` bars drift. Everything here reads `window.visualViewport`
// so surfaces can be sized against what the user can actually see.

/** Breakpoint shared with Tailwind's `md:` — below this the app is "mobile". */
export const MOBILE_MAX_WIDTH = 767

/**
 * A phone in landscape is WIDER than the md breakpoint (an iPhone 14 Pro is
 * 844×390) but is still a phone, and it is the case that needs a full-screen
 * assistant most — 390px of height with a keyboard open leaves no room for a
 * docked panel. Height is what actually distinguishes it: desktop browser
 * windows are essentially never under 500px tall.
 */
export const MOBILE_MAX_HEIGHT = 500

export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px), (max-height: ${MOBILE_MAX_HEIGHT}px)`

/**
 * The visible viewport rectangle. `height`/`offsetTop` are what a full-screen
 * overlay must be sized and offset by so it exactly fills the space above the
 * keyboard. `keyboardOpen` is derived from how much of the layout viewport the
 * visual viewport has lost — the 120px floor keeps browser chrome collapsing
 * (address bar hide/show) from reading as a keyboard.
 *
 * Falls back to the layout viewport when visualViewport is unsupported, so the
 * overlay is still correctly sized rather than collapsing to zero height.
 */
export interface VisualViewportRect {
  height: number
  offsetTop: number
  keyboardOpen: boolean
}

const KEYBOARD_MIN_HEIGHT = 120

function readRect(): VisualViewportRect {
  if (typeof window === 'undefined') return { height: 0, offsetTop: 0, keyboardOpen: false }
  const vv = window.visualViewport
  if (!vv) return { height: window.innerHeight, offsetTop: 0, keyboardOpen: false }
  return {
    height: vv.height,
    offsetTop: vv.offsetTop || 0,
    keyboardOpen: window.innerHeight - vv.height > KEYBOARD_MIN_HEIGHT,
  }
}

export function useVisualViewportRect(): VisualViewportRect {
  const [rect, setRect] = useState<VisualViewportRect>(readRect)

  useEffect(() => {
    let active = true
    // Applied synchronously rather than coalesced into a requestAnimationFrame.
    // rAF does not fire while the page is not compositing (backgrounded tab,
    // occluded window), which would leave a full-screen sheet holding a stale
    // height until the next resize — exactly the broken state a user returns to
    // after switching apps. React batches these updates anyway, and the equality
    // guard means an event that changes nothing costs no re-render.
    const update = () => {
      if (!active) return
      setRect(current => {
        const next = readRect()
        if (current.height === next.height && current.offsetTop === next.offsetTop && current.keyboardOpen === next.keyboardOpen) {
          return current
        }
        return next
      })
    }

    const vv = window.visualViewport
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    // Rotation and browser-chrome changes do not always fire a visualViewport
    // event, and returning from the background can resume with a stale rect.
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    window.addEventListener('pageshow', update)
    document.addEventListener('visibilitychange', update)
    update()

    return () => {
      active = false
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.removeEventListener('pageshow', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return rect
}

/**
 * Legacy inset helper: how far a fixed footer must lift to clear the keyboard.
 * Still used by the collapsed launcher, which docks rather than fills.
 */
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

/** True while the viewport is phone-sized, in either orientation. */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA_QUERY).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(MOBILE_MEDIA_QUERY)
    const update = () => setIsMobile(query.matches)
    query.addEventListener('change', update)
    // Re-read on resize/rotation as well. The `change` event alone is enough on
    // a real device, but it does not fire in every embedded/automated browser,
    // and a stale value here decides whether the assistant is full-screen —
    // too important to depend on a single signal.
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    window.visualViewport?.addEventListener('resize', update)
    update()
    return () => {
      query.removeEventListener('change', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  return isMobile
}

/**
 * Freeze the page behind a full-screen overlay and restore it exactly on close.
 *
 * `overflow: hidden` alone does not stop iOS Safari scrolling the document, so
 * the body is pinned with `position: fixed` at its current offset. That offset
 * is captured on lock and scrolled back to on release, which is what makes
 * closing the assistant return the user to precisely where they were.
 *
 * The captured scroll position is held outside React state so a re-render
 * during the lock can never overwrite it with the pinned value of 0.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const body = document.body
    const scrollY = window.scrollY
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'

    return () => {
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.left = previous.left
      body.style.right = previous.right
      body.style.width = previous.width
      body.style.overflow = previous.overflow
      body.style.overscrollBehavior = previous.overscrollBehavior
      window.scrollTo(0, scrollY)
    }
  }, [active])
}
