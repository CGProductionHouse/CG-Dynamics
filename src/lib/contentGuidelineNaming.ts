// Canonical Content Guideline video naming (#224).
//
// Every video in a Content Run's ONE canonical guideline is named
// "Video XX - Descriptive Name", where XX is its 1-based place in the ordered guideline,
// zero-padded to two digits. The number is derived from the saved order when a name is
// shown, so reordering renumbers every surface (editor, Shoot Mode, client portal)
// without rewriting stored titles. The stored `title` holds only the descriptive name.

// A leading "Video 1 -", "VIDEO 02 —", "Video #3:" or a bare "Video 4". The number must be
// followed by a separator or the end, so "Video 10 Tips" is a real name and is kept.
const NUMBER_PREFIX = /^\s*video\s*[#:.]?\s*\d{1,3}\s*(?:[-–—:|.]\s*|$)/i

/** "Video 01" for position 1. Non-positive or non-integer positions render as "Video 00". */
export function guidelineVideoNumber(position: number): string {
  const n = Number.isInteger(position) && position > 0 ? position : 0
  return `Video ${String(n).padStart(2, '0')}`
}

/** The descriptive part of a stored title, without any legacy "Video N -" prefix. */
export function stripVideoNumberPrefix(title: string | null | undefined): string {
  return (title ?? '').trim().replace(NUMBER_PREFIX, '').trim()
}

/** "Video 01 - Descriptive Name", or just "Video 01" when there is no descriptive name yet. */
export function guidelineVideoName(position: number, title: string | null | undefined): string {
  const name = stripVideoNumberPrefix(title)
  return name ? `${guidelineVideoNumber(position)} - ${name}` : guidelineVideoNumber(position)
}
