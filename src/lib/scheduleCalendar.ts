// Shared month-calendar grid maths for the Client Schedule and the
// client-ready Content Calendar surfaces.
//
// Presentation-only helpers over a YYYY-MM month key — single source for the
// Monday-first week columns, month-coupling leading/trailing cells and the
// local "today" key. No data access, no writes.

export const CALENDAR_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export interface CalendarGridCell {
  day: number
  iso: string
  outside: boolean
}

export function localIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayIso(): string {
  return localIso(new Date())
}

// Monday-first full-week cells for the month: dates of the previous and next
// month fill the leading/trailing gaps so every row is exactly 7 cells.
// `outside` marks those adjacent-month days.
export function monthGridCells(month: string): CalendarGridCell[] {
  const [year, m] = month.split('-').map(Number)
  const monthIndex = m - 1
  const daysInMonth = new Date(year, m, 0).getDate()
  // getDay() is Sunday-first (0), so rotate to make Monday the first column.
  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const cells: CalendarGridCell[] = []
  const pad = (date: Date) => localIso(date)
  for (let offset = leading; offset > 0; offset--) {
    const date = new Date(year, monthIndex, 1 - offset)
    cells.push({ day: date.getDate(), iso: pad(date), outside: true })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day)
    cells.push({ day, iso: pad(date), outside: false })
  }
  const trailing = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7)
  for (let i = 1; i <= trailing; i++) {
    const date = new Date(year, monthIndex, daysInMonth + i)
    cells.push({ day: date.getDate(), iso: pad(date), outside: true })
  }
  return cells
}