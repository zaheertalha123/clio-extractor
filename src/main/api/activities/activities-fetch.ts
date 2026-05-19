import type { ClioRequestFn } from '../shared/clio-request'
import { startOfLocalDayIso } from '../shared/matter-list-date-filters'
import { buildActivityFieldsParam } from './activity-fetch-fields'

/** Clio offset pagination cap (50 pages × 200). */
const MAX_OFFSET_RECORDS = 10_000

export interface ActivitiesFetchInput {
  /** Requested UI field keys (see activity-fetch-fields). */
  fieldKeys: string[]
  /** Omit for both Time Entry and Expense */
  activityType?: 'TimeEntry' | 'ExpenseEntry'
  /** Activity date range (`YYYY-MM-DD` from UI) */
  startDate: string
  endDate: string
}

export interface ActivitiesFetchResult {
  data: unknown[]
  recordCount: number
  error?: string
}

function extractRows(body: unknown): unknown[] {
  const b = body as { data?: unknown[] }
  return Array.isArray(b?.data) ? b.data : []
}

function buildActivitiesQuery(opts: {
  fields: string
  startDateIso: string
  endDateIso: string
  activityType?: 'TimeEntry' | 'ExpenseEntry'
  offset: number
  limit: number
}): string {
  const p = new URLSearchParams()
  p.set('start_date', opts.startDateIso)
  p.set('end_date', opts.endDateIso)
  p.set('order', 'date(desc)')
  p.set('limit', String(opts.limit))
  p.set('fields', opts.fields)
  p.append('meta[account_has_any]', 'true')
  p.append('meta[aggregates]', 'true')
  if (opts.offset > 0) {
    p.set('offset', String(opts.offset))
  }
  if (opts.activityType) {
    p.set('type', opts.activityType)
  }
  return p.toString()
}

/**
 * Fetches activities for the account by date range and optional type.
 * Uses offset pagination (required when `order` is not `id(asc)`).
 */
export async function fetchActivities(
  request: ClioRequestFn,
  input: ActivitiesFetchInput
): Promise<ActivitiesFetchResult> {
  const fieldKeys = [...new Set(input.fieldKeys.map((k) => k.trim()).filter((k) => k.length > 0))]
  if (fieldKeys.length === 0) {
    return { data: [], recordCount: 0, error: 'Select at least one field to fetch' }
  }

  const startDateIso = startOfLocalDayIso(input.startDate.trim())
  const endDateIso = startOfLocalDayIso(input.endDate.trim())
  if (!startDateIso || !endDateIso) {
    return { data: [], recordCount: 0, error: 'Invalid activity date range' }
  }

  const fields = buildActivityFieldsParam(fieldKeys)
  const rows: unknown[] = []
  const limit = 200
  let offset = 0

  while (offset < MAX_OFFSET_RECORDS) {
    const qs = buildActivitiesQuery({
      fields,
      startDateIso,
      endDateIso,
      activityType: input.activityType,
      offset,
      limit
    })
    const res = await request(`/activities?${qs}`)
    if (res.error) {
      return { data: rows.length ? rows : [], recordCount: rows.length, error: res.error }
    }
    const batch = extractRows(res.data)
    rows.push(...batch)
    if (batch.length < limit) {
      break
    }
    offset += batch.length
  }

  return { data: rows, recordCount: rows.length }
}
