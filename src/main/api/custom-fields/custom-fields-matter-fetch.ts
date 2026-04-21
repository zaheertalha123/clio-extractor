import type { ClioRequestFn } from '../shared/clio-request'
import {
  appendMatterListDateRangeQuery,
  matterListOrderForStatus
} from '../shared/matter-list-date-filters'

/** Matter list fields focused on custom_field_values (Clio v4 single-level nesting). */
const CUSTOM_FIELDS_PAGE_MATTERS_FIELDS =
  'id,display_number,status,custom_field_values{id,custom_field,field_name,value,field_type,picklist_option,field_required,field_displayed,field_display_order,matter,contact,soft_deleted}'

export interface CustomFieldsMatterFetchInput {
  /** When true, list all matters (paginated) with optional status filter. */
  allMatters: boolean
  /** Matter display_number values when `allMatters` is false. */
  matterDisplayNumbers: string[]
  /** Clio `custom_field` ids to request via `custom_field_ids[]`. */
  customFieldIds: number[]
  /** Clio matter `status` filter (e.g. Open). Omit for all statuses. */
  matterStatus?: string
  /**
   * Date range when `allMatters` is true (`YYYY-MM-DD`). Same rules as Matters page:
   * Open/Pending → `open_date`; Closed → `close_date`.
   */
  openDateAfter?: string
  openDateBefore?: string
}

export interface CustomFieldsMatterFetchResult {
  /** Raw matter objects from Clio (each includes `custom_field_values` for requested ids). */
  data: unknown[]
  recordCount: number
  error?: string
}

function buildQuery(opts: {
  offset: number
  limit: number
  query?: string
  matterStatus?: string
  customFieldIds: number[]
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
  p.set('fields', CUSTOM_FIELDS_PAGE_MATTERS_FIELDS)
  for (const id of opts.customFieldIds) {
    p.append('custom_field_ids[]', String(id))
  }
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
 * Fetches matters with the requested custom field values via GET /matters (Clio API v4).
 */
export async function fetchCustomFieldsMatterData(
  request: ClioRequestFn,
  input: CustomFieldsMatterFetchInput
): Promise<CustomFieldsMatterFetchResult> {
  const customFieldIds = [...new Set(input.customFieldIds)]
  if (customFieldIds.length === 0) {
    return { data: [], recordCount: 0, error: 'No custom field ids to fetch' }
  }

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
        customFieldIds,
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
        customFieldIds
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
