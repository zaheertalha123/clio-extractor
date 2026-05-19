/**
 * UI field keys ↔ Clio GET /activities `fields` fragments.
 * Nested associations use a single `{...}` level only (no `matter{client{name}}`).
 */
export const ACTIVITY_FETCH_FIELD_KEYS = [
  'matter_id',
  'matter_description',
  'activity_id',
  'type',
  'description',
  'activity_category',
  'quantity',
  'client_name',
  'user_name',
  'date',
  'rate',
  'billable',
  'non_billable',
  'invoice_status',
  'invoice_number',
  'bill_status'
] as const

export type ActivityFetchFieldKey = (typeof ACTIVITY_FETCH_FIELD_KEYS)[number]

/** Subfields inside `matter{...}` — flat names only. */
const MATTER_SUBFIELD: Partial<Record<ActivityFetchFieldKey, string>> = {
  matter_id: 'display_number',
  matter_description: 'description',
  client_name: 'client'
}

/** Subfields inside `bill{...}` — flat names only. */
const BILL_SUBFIELD: Partial<Record<ActivityFetchFieldKey, string>> = {
  invoice_number: 'number',
  bill_status: 'state'
}

/** Top-level or single-level association fragments (no `bill{...}` here). */
const TOP_LEVEL_FRAGMENT: Partial<Record<ActivityFetchFieldKey, string>> = {
  activity_id: 'id',
  type: 'type',
  description: 'activity_description{name}',
  activity_category: 'expense_category{name}',
  quantity: 'quantity',
  user_name: 'user{name}',
  date: 'date',
  rate: 'price',
  non_billable: 'non_billable',
  billable: 'non_billable',
  invoice_status: 'billed,on_bill'
}

function collectBillSubfields(keys: ActivityFetchFieldKey[]): Set<string> {
  const billParts = new Set<string>()
  for (const key of keys) {
    const part = BILL_SUBFIELD[key]
    if (part) {
      billParts.add(part)
    }
    if (key === 'invoice_status') {
      billParts.add('number')
      billParts.add('state')
    }
  }
  return billParts
}

export function buildActivityFieldsParam(fieldKeys: string[]): string {
  const keys = fieldKeys.filter((k): k is ActivityFetchFieldKey =>
    (ACTIVITY_FETCH_FIELD_KEYS as readonly string[]).includes(k)
  )
  if (keys.length === 0) {
    return 'id'
  }

  const matterSubfields = new Set<string>()
  const topFragments: string[] = []

  const pushTop = (frag: string): void => {
    if (!topFragments.includes(frag)) {
      topFragments.push(frag)
    }
  }

  for (const key of keys) {
    const matterPart = MATTER_SUBFIELD[key]
    if (matterPart) {
      matterSubfields.add(matterPart)
      continue
    }
    const top = TOP_LEVEL_FRAGMENT[key]
    if (top) {
      for (const frag of top.split(',')) {
        pushTop(frag.trim())
      }
    }
  }

  const parts: string[] = []
  if (matterSubfields.size > 0) {
    parts.push(`matter{${[...matterSubfields].join(',')}}`)
  }

  const billSubfields = collectBillSubfields(keys)
  if (billSubfields.size > 0) {
    parts.push(`bill{${[...billSubfields].join(',')}}`)
  }

  parts.push(...topFragments)

  return parts.join(',')
}
