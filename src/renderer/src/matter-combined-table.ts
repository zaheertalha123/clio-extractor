import { buildMattersGeneralDetailsTablePayload } from './matters-page'
import { buildCustomFieldsPageTablePayload } from './custom-fields-page'

/** Single table: Matter ID + general-detail columns + custom field columns (no duplicate Status from CF slice). */
export function buildMatterCombinedTablePayload(
  matters: unknown[],
  detailKeys: string[],
  customFieldIds: number[]
): { columns: Array<{ key: string; label: string }>; records: Record<string, unknown>[] } {
  const { columns: gdCols, records: gdRec } = buildMattersGeneralDetailsTablePayload(matters, detailKeys)
  const { columns: cfColsFull, records: cfRec } = buildCustomFieldsPageTablePayload(matters, customFieldIds)
  const cfOnlyCols = cfColsFull.filter((c) => c.key.startsWith('cf_'))
  const cfByDisplay = new Map<string, Record<string, unknown>>()
  for (const row of cfRec) {
    cfByDisplay.set(String(row.display_number ?? ''), row)
  }
  const records = gdRec.map((gdRow) => {
    const cfRow = cfByDisplay.get(String(gdRow.display_number ?? ''))
    const out: Record<string, unknown> = { ...gdRow }
    for (const col of cfOnlyCols) {
      out[col.key] = cfRow ? (cfRow[col.key] ?? '') : ''
    }
    return out
  })
  return { columns: [...gdCols, ...cfOnlyCols], records }
}
