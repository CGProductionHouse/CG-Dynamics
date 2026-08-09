// ── Shared responsive layout system (#181) ───────────────────────────────────
//
// One source of truth for page gutters, content width, section spacing and the
// fixed-shell offsets. Screens consume these instead of inventing their own
// margins/widths, so the whole authenticated product uses the same mobile
// spacing. Pure strings (no JSX) so they are trivially unit-testable and usable
// anywhere. The AdminLayout <main> already owns the bottom safe-area / assistant
// / bottom-nav offset, so page primitives must NOT re-add bottom insets.

// Horizontal page gutter — identical on every authenticated screen. Small on
// phones, comfortable on desktop. Never wider than this so content never starts
// off-screen and adjacent sections always share one gutter.
export const PAGE_GUTTER = 'px-4 sm:px-6 lg:px-8'

// Content max-widths. `wide` is the default operational width; `medium` suits
// focused detail/list pages; `narrow` suits forms and settings.
export const PAGE_MAX_WIDTH = {
  wide: 'max-w-7xl',
  content: 'max-w-6xl',
  medium: 'max-w-5xl',
  narrow: 'max-w-3xl',
  full: 'max-w-none',
} as const

export type PageWidth = keyof typeof PAGE_MAX_WIDTH

// Top padding under the sticky header, and the vertical rhythm between sections.
export const PAGE_TOP = 'pt-4 sm:pt-6'
export const SECTION_GAP = 'space-y-4 sm:space-y-6'

// Card padding + gaps, and the mobile-first heading scale. Oversized desktop
// type scales down on small screens so headings never overrun the viewport.
export const CARD_PADDING = 'p-4 sm:p-5'
export const CARD_GAP = 'gap-3 sm:gap-4'
export const PAGE_HEADING = 'text-xl font-black tracking-tight text-white sm:text-2xl'
export const PAGE_EYEBROW = 'text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal'
export const PAGE_DESCRIPTION = 'text-sm leading-relaxed text-brand-primary/70'

// Minimum interactive control height — keeps tap targets consistent and legible
// on touch without becoming oversized.
export const CONTROL_MIN_H = 'min-h-11'

// The class for a standard page container: centered, gutter, width and min-w-0
// so flex/grid children can shrink instead of forcing horizontal overflow.
export function pageContainerClass(width: PageWidth = 'wide', extra = ''): string {
  return ['mx-auto w-full min-w-0', PAGE_MAX_WIDTH[width], PAGE_GUTTER, PAGE_TOP, extra].filter(Boolean).join(' ')
}

// A horizontal control row (search + filters + actions) that wraps instead of
// overflowing. Intentional horizontal-scroll surfaces use `scrollRowClass`.
export const TOOLBAR_ROW = 'flex flex-wrap items-center gap-2'

// A deliberately horizontally-scrollable surface (boards, wide tables). Scrolls
// inside its own container so the page body never scrolls sideways.
export const SCROLL_ROW = 'flex gap-3 overflow-x-auto overscroll-x-contain pb-2'
