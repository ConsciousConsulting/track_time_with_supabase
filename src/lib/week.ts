/**
 * Week helpers for the Planning page (Monday–Friday work weeks).
 */

/** Local calendar date as YYYY-MM-DD. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Monday 00:00 local for the week containing `date`. */
export function startOfWeekMonday(date: Date): Date {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = local.getDay()
  const diff = day === 0 ? -6 : 1 - day
  local.setDate(local.getDate() + diff)
  return local
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

/** Monday–Friday dates for the week that contains `anchor`. */
export function weekdaysMonToFri(anchor: Date): Date[] {
  const monday = startOfWeekMonday(anchor)
  return [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset))
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Header range: "Monday 9 March 2026 – Friday 13 March 2026" */
export function formatWeekRangeFull(monday: Date, friday: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }
  return `${monday.toLocaleDateString(undefined, opts)} – ${friday.toLocaleDateString(undefined, opts)}`
}

/** Card title: "Monday 9" */
export function formatWeekdayCard(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
  })
}
