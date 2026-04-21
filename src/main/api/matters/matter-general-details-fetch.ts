import type { ClioRequestFn } from '../shared/clio-request'
import {
  appendMatterListDateRangeQuery,
  matterListOrderForStatus
} from '../shared/matter-list-date-filters'

/**
 * Maps UI / frontend keys to Clio GET /matters `fields` fragments (v4).
 * Only these general-detail slices are supported.
 */
export const MATTER_GENERAL_DETAIL_FIELD_MAP: Readonly<Record<string, string>> = {
  description: 'description',
  responsible_attorney: 'responsible_attorney{name}',
  responsible_staff: 'responsible_staff{name}',
  blocked_users: 'blocked_groups{name,id,type,users}',
  originating_attorney: 'originating_attorney{name}',
  practice_area: 'practice_area{name,category}',
  matter_stage: 'matter_stage{id,name}',
  client_reference: 'client_reference',
  location: 'location',
  status: 'status',
  open_date: 'open_date',
  pending_date: 'pending_date',
  close_date: 'close_date',
  limitations_date: 'statute_of_limitations{id,due_at,status,reminders}',
  billable: 'billable',
  maildrop_address: 'maildrop_address'
}

export const MATTER_GENERAL_DETAIL_KEYS = Object.freeze(
  Object.keys(MATTER_GENERAL_DETAIL_FIELD_MAP)
) as readonly string[]

export interface MatterGeneralDetailsFetchInput {
  allMatters: boolean
  matterDisplayNumbers: string[]
  matterStatus?: string
  /** Requested general-detail keys (see MATTER_GENERAL_DETAIL_FIELD_MAP). Empty = all supported keys. */
  detailKeys: string[]
  /**
   * Date range filter (only when `allMatters` is true). Values are `YYYY-MM-DD` from the UI.
   * - **Open** / **Pending** (and other non-closed): filters **`open_date`** (`open_date`, `open_date[]`).
   * **Closed**: filters **`close_date`** so the range applies to when the matter was closed, not opened.
   */
  openDateAfter?: string
  openDateBefore?: string
}

export interface MatterGeneralDetailsFetchResult {
  data: unknown[]
  recordCount: number
  error?: string
}

const BASE_LIST_FIELDS = 'id,display_number'

function buildFieldsParam(detailKeys: string[]): string {
  const keys =
    detailKeys.length > 0
      ? [...new Set(detailKeys.filter((k) => k in MATTER_GENERAL_DETAIL_FIELD_MAP))]
      : [...MATTER_GENERAL_DETAIL_KEYS]
  const parts = [BASE_LIST_FIELDS]
  for (const k of keys) {
    const frag = MATTER_GENERAL_DETAIL_FIELD_MAP[k]
    if (frag && !parts.includes(frag)) {
      parts.push(frag)
    }
  }
  return parts.join(',')
}

function buildQuery(opts: {
  offset: number
  limit: number
  query?: string
  matterStatus?: string
  fields: string
  openDateAfter?: string
  openDateBefore?: string
}): string {
  const p = new URLSearchParams()
  p.set('offset', String(opts.offset))
  p.set('limit', String(opts.limit))
  p.set('order', matterListOrderForStatus(opts.matterStatus))
  p.set('matter_access', 'full')
  if (opts.matterStatus) {
    p.set('status', opts.matterStatus)
  }
  p.set('fields', opts.fields)
  if (opts.query != null && opts.query !== '') {
    p.set('query', opts.query.trim())
  }
  appendMatterListDateRangeQuery(p, opts.matterStatus, opts.openDateAfter, opts.openDateBefore)
  return p.toString()
}

function extractMatterRows(body: unknown): unknown[] {
  const b = body as { data?: unknown[] }
  return Array.isArray(b?.data) ? b.data : []
}

/**
 * Fetches matters with only the requested general-detail fields via GET /matters (paginated list).
 */
export async function fetchMatterGeneralDetails(
  request: ClioRequestFn,
  input: MatterGeneralDetailsFetchInput
): Promise<MatterGeneralDetailsFetchResult> {
  const fields = buildFieldsParam(input.detailKeys ?? [])
  const limit = 50
  const matterStatus = input.matterStatus?.trim() || undefined
  const openDateAfter = input.allMatters ? input.openDateAfter?.trim() || undefined : undefined
  const openDateBefore = input.allMatters ? input.openDateBefore?.trim() || undefined : undefined

  if (input.allMatters) {
    const rows: unknown[] = []
    let offset = 0
    const maxPages = 2000
    for (let page = 0; page < maxPages; page++) {
      const qs = buildQuery({
        offset,
        limit,
        matterStatus,
        fields,
        openDateAfter,
        openDateBefore
      })
      const res = await request(`/matters?${qs}`)
      if (res.error) {
        return { data: [], recordCount: 0, error: res.error }
      }
      const batch = extractMatterRows(res.data)
      rows.push(...batch)
      if (batch.length < limit) {
        break
      }
      offset += limit
    }
    return { data: rows, recordCount: rows.length }
  }

  const uniqueDisplays = [
    ...new Set(input.matterDisplayNumbers.map((s) => s.trim()).filter((s) => s.length > 0))
  ]
  if (uniqueDisplays.length === 0) {
    return { data: [], recordCount: 0, error: 'No matters selected' }
  }

  const rows: unknown[] = []
  const seenMatterIds = new Set<number>()

  for (const display of uniqueDisplays) {
    let offset = 0
    let found = false
    const maxPages = 100
    for (let page = 0; page < maxPages && !found; page++) {
      const qs = buildQuery({
        offset,
        limit,
        query: display,
        matterStatus,
        fields
      })
      const res = await request(`/matters?${qs}`)
      if (res.error) {
        return { data: [], recordCount: 0, error: res.error }
      }
      const batch = extractMatterRows(res.data)
      for (const raw of batch) {
        const m = raw as { id?: number; display_number?: string }
        if (String(m.display_number ?? '') !== display) {
          continue
        }
        const mid = m.id
        if (mid != null && !seenMatterIds.has(mid)) {
          seenMatterIds.add(mid)
          rows.push(raw)
          found = true
          break
        }
      }
      if (found) {
        break
      }
      if (batch.length < limit) {
        break
      }
      offset += limit
    }
  }

  return { data: rows, recordCount: rows.length }
}
