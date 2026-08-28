import type { ReactNode } from 'react'
import {
  CARD_PADDING,
  PAGE_DESCRIPTION,
  PAGE_EYEBROW,
  PAGE_HEADING,
  SECTION_GAP,
  TOOLBAR_ROW,
  pageContainerClass,
  type PageWidth,
} from '../../lib/layout'

// ── Shared page primitives (#181) ────────────────────────────────────────────
//
// Every authenticated screen wraps its content in <PageContainer> so it gets the
// one shared gutter, max-width and top spacing — no more per-screen margins.
// <PageHeader> is the one compact title block (eyebrow + title + description +
// actions) that replaces oversized bespoke hero headers (#180). The AdminLayout
// <main> already reserves space for the bottom nav / assistant, so nothing here
// adds bottom insets.

export function PageContainer({
  children, width = 'wide', gap = true, className = '',
}: {
  children: ReactNode
  width?: PageWidth
  // Apply the shared vertical section rhythm between direct children.
  gap?: boolean
  className?: string
}) {
  return (
    <div className={`${pageContainerClass(width)} ${gap ? SECTION_GAP : ''} ${className}`.trim()}>
      {children}
    </div>
  )
}

export function PageHeader({
  eyebrow, title, description, actions, className = '',
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}>
      <div className="min-w-0">
        {eyebrow && <p className={PAGE_EYEBROW}>{eyebrow}</p>}
        <h1 className={`${eyebrow ? 'mt-1.5' : ''} ${PAGE_HEADING} break-words`}>{title}</h1>
        {description && <p className={`mt-2 max-w-2xl ${PAGE_DESCRIPTION}`}>{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

// A titled section block with the shared card framing. Keeps section spacing and
// padding consistent so cards always fit inside the content container.
export function Section({
  title, actions, children, className = '',
}: {
  title?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.02] ${CARD_PADDING} ${className}`.trim()}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/45">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

// A wrapping control row (search + filters + actions) that never forces the page
// to scroll sideways on mobile.
export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${TOOLBAR_ROW} ${className}`.trim()}>{children}</div>
}
