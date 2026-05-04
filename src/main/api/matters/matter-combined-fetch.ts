import type { ClioRequestFn } from '../shared/clio-request'
import {
  fetchCustomFieldsMatterData,
  type CustomFieldsMatterFetchInput
} from '../custom-fields/custom-fields-matter-fetch'
import {
  fetchMatterGeneralDetails,
  type MatterGeneralDetailsFetchInput
} from './matter-general-details-fetch'

export interface MatterCombinedFetchInput extends MatterGeneralDetailsFetchInput {
  customFieldIds: number[]
}

export interface MatterCombinedFetchResult {
  data: unknown[]
  recordCount: number
  error?: string
}

function matterIdFromRow(raw: unknown): number | undefined {
  const m = raw as { id?: unknown }
  const id = m?.id
  return typeof id === 'number' && Number.isFinite(id) ? id : undefined
}

/** Merge general-detail matter rows with `custom_field_values` from the custom-fields fetch (matched by matter id). */
export function mergeGeneralDetailsWithCustomFieldRows(
  generalRows: unknown[],
  customFieldRows: unknown[]
): unknown[] {
  const cfById = new Map<number, Record<string, unknown>>()
  for (const raw of customFieldRows) {
    const id = matterIdFromRow(raw)
    if (id != null) {
      cfById.set(id, raw as Record<string, unknown>)
    }
  }
  return generalRows.map((gdRaw) => {
    const gd = gdRaw as Record<string, unknown>
    const id = matterIdFromRow(gdRaw)
    const cf = id != null ? cfById.get(id) : undefined
    const cfVals = cf?.custom_field_values
    return {
      ...gd,
      custom_field_values: Array.isArray(cfVals) ? cfVals : []
    }
  })
}

/**
 * Runs matter general-details and custom-field-value fetches in parallel with the same filters,
 * then merges rows so each matter includes `custom_field_values` for the table UI.
 */
export async function fetchMatterGeneralDetailsAndCustomFields(
  request: ClioRequestFn,
  input: MatterCombinedFetchInput
): Promise<MatterCombinedFetchResult> {
  const gdInput: MatterGeneralDetailsFetchInput = {
    allMatters: input.allMatters,
    matterDisplayNumbers: input.matterDisplayNumbers,
    matterStatus: input.matterStatus,
    detailKeys: input.detailKeys,
    openDateAfter: input.openDateAfter,
    openDateBefore: input.openDateBefore
  }

  const cfIds = [...new Set(input.customFieldIds.filter((id) => Number.isFinite(id)))]

  if (cfIds.length === 0) {
    const gdRes = await fetchMatterGeneralDetails(request, gdInput)
    if (gdRes.error) {
      return { data: [], recordCount: 0, error: gdRes.error }
    }
    const merged = gdRes.data.map((row) => ({
      ...(row as Record<string, unknown>),
      custom_field_values: []
    }))
    return { data: merged, recordCount: merged.length }
  }

  const cfInput: CustomFieldsMatterFetchInput = {
    allMatters: input.allMatters,
    matterDisplayNumbers: input.matterDisplayNumbers,
    customFieldIds: cfIds,
    matterStatus: input.matterStatus,
    openDateAfter: input.openDateAfter,
    openDateBefore: input.openDateBefore
  }

  const [gdRes, cfRes] = await Promise.all([
    fetchMatterGeneralDetails(request, gdInput),
    fetchCustomFieldsMatterData(request, cfInput)
  ])

  if (gdRes.error) {
    return { data: [], recordCount: 0, error: gdRes.error }
  }
  if (cfRes.error) {
    return { data: [], recordCount: 0, error: cfRes.error }
  }

  const merged = mergeGeneralDetailsWithCustomFieldRows(gdRes.data, cfRes.data)
  return { data: merged, recordCount: merged.length }
}
