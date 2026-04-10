import type { ClioRequestFn } from '../shared/clio-request'

/** Matter row from GET /matters?query=… (display ID search). Reusable across features. */
export type MatterByDisplayIdRow = {
  id: number
  display_number: string
  description: string | null
}

const LIST_FIELDS = 'id,display_number,description'

/**
 * GET /matters — search matters by query (typically partial or full display number / matter text).
 */
export async function getMattersByDisplayId(
  request: ClioRequestFn,
  query: string
): Promise<{ data: MatterByDisplayIdRow[]; error?: string }> {
  const q = query.trim()
  if (q.length === 0) {
    return { data: [] }
  }

  const params = new URLSearchParams()
  params.set('query', q)
  params.set('limit', '50')
  params.set('fields', LIST_FIELDS)

  const res = await request(`/matters?${params.toString()}`)
  if (res.error) {
    return { data: [], error: res.error }
  }

  const body = res.data as {
    data?: Array<{
      id?: number
      display_number?: string
      description?: string | null
    }>
  }
  const raw = body?.data ?? []
  const data: MatterByDisplayIdRow[] = []
  for (const row of raw) {
    if (row?.id == null) continue
    data.push({
      id: Number(row.id),
      display_number: row.display_number != null ? String(row.display_number) : '',
      description: row.description ?? null
    })
  }
  return { data }
}
