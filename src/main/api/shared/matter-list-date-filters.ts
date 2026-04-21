/**
 * Clio GET /matters list: open_date vs close_date range filters and sort order.
 * Used by Matters (general details) and Custom Fields bulk fetches.
 */

export function matterListDateFilterField(matterStatus?: string): 'open_date' | 'close_date' {
  return matterStatus === 'Closed' ? 'close_date' : 'open_date'
}

export function matterListOrderForStatus(matterStatus?: string): string {
  return matterListDateFilterField(matterStatus) === 'close_date' ? 'close_date(desc)' : 'open_date(desc)'
}

/** `YYYY-MM-DD` → start of that day in local time, as ISO string for Clio. */
function startOfLocalDayIso(dateStr: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const local = new Date(y, mo - 1, d)
  if (local.getFullYear() !== y || local.getMonth() !== mo - 1 || local.getDate() !== d) return null
  return local.toISOString()
}

/** Exclusive upper bound: start of the day after `dateStr` in local time. */
function startOfNextLocalDayIso(dateStr: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const next = new Date(y, mo - 1, d + 1)
  return next.toISOString()
}

/**
 * Append open_date or close_date filters to a /matters query.
 * Closed → close_date; otherwise → open_date.
 */
export function appendMatterListDateRangeQuery(
  p: URLSearchParams,
  matterStatus: string | undefined,
  dateAfter?: string,
  dateBefore?: string
): void {
  const field = matterListDateFilterField(matterStatus)
  const afterIso = dateAfter?.trim() ? startOfLocalDayIso(dateAfter) : null
  const beforeExclusiveIso = dateBefore?.trim() ? startOfNextLocalDayIso(dateBefore) : null

  if (afterIso && beforeExclusiveIso) {
    p.append(`${field}[]`, `>${afterIso}`)
    p.append(`${field}[]`, `<${beforeExclusiveIso}`)
  } else if (afterIso) {
    p.append(field, `>${afterIso}`)
  } else if (beforeExclusiveIso) {
    p.append(field, `<${beforeExclusiveIso}`)
  }
}
