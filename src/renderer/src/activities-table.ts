import { ACTIVITY_FIELD_OPTIONS } from './activities-fields-shared'

function formatCell(v: unknown): string {
  if (v == null) {
    return ''
  }
  if (typeof v === 'boolean') {
    return v ? 'Yes' : 'No'
  }
  if (typeof v === 'object') {
    return JSON.stringify(v)
  }
  return String(v)
}

function nameFromObject(v: unknown, key = 'name'): string {
  if (v == null || typeof v !== 'object') {
    return ''
  }
  const n = (v as Record<string, unknown>)[key]
  return n != null ? String(n).trim() : ''
}

function matterPart(matter: unknown): Record<string, unknown> | null {
  if (matter == null || typeof matter !== 'object') {
    return null
  }
  return matter as Record<string, unknown>
}

function billPart(bill: unknown): Record<string, unknown> | null {
  if (bill == null || typeof bill !== 'object') {
    return null
  }
  return bill as Record<string, unknown>
}

function formatInvoiceStatus(a: Record<string, unknown>): string {
  const billed = a.billed
  const onBill = a.on_bill
  const bill = billPart(a.bill)
  if (bill) {
    const stateStr = bill.state != null ? String(bill.state) : ''
    const numStr = bill.number != null ? String(bill.number) : ''
    if (stateStr && numStr) {
      return `${stateStr} (#${numStr})`
    }
    if (stateStr) {
      return stateStr
    }
  }
  if (billed === true) {
    return 'Billed'
  }
  if (onBill === true) {
    return 'On bill'
  }
  if (billed === false) {
    return 'Unbilled'
  }
  return ''
}

function formatBillable(a: Record<string, unknown>): string {
  if (Object.prototype.hasOwnProperty.call(a, 'non_billable')) {
    return a.non_billable === true ? 'No' : 'Yes'
  }
  return ''
}

type FieldExtractor = (a: Record<string, unknown>) => unknown

const FIELD_EXTRACTORS: Record<string, FieldExtractor> = {
  matter_id: (a) => matterPart(a.matter)?.display_number ?? '',
  matter_description: (a) => matterPart(a.matter)?.description ?? '',
  activity_id: (a) => a.id ?? '',
  type: (a) => a.type ?? '',
  description: (a) => nameFromObject(a.activity_description),
  activity_category: (a) => nameFromObject(a.expense_category),
  quantity: (a) => a.quantity ?? '',
  client_name: (a) => nameFromObject(matterPart(a.matter)?.client),
  user_name: (a) => nameFromObject(a.user),
  date: (a) => a.date ?? '',
  rate: (a) => a.price ?? '',
  billable: (a) => formatBillable(a),
  non_billable: (a) => (a.non_billable === true ? 'Yes' : a.non_billable === false ? 'No' : ''),
  invoice_status: (a) => formatInvoiceStatus(a),
  invoice_number: (a) => {
    const num = billPart(a.bill)?.number
    return num != null ? String(num) : ''
  },
  bill_status: (a) => {
    const state = billPart(a.bill)?.state
    return state != null ? String(state) : ''
  }
}

const LABEL_BY_KEY = new Map(ACTIVITY_FIELD_OPTIONS.map((o) => [o.key, o.label]))

export function buildActivitiesTablePayload(
  activities: unknown[],
  fieldKeys: string[]
): { columns: Array<{ key: string; label: string }>; records: Record<string, unknown>[] } {
  const keys = fieldKeys.filter((k) => k in FIELD_EXTRACTORS)
  const columns = keys.map((k) => ({
    key: k,
    label: LABEL_BY_KEY.get(k) ?? k
  }))

  const records = activities.map((raw) => {
    const a = raw as Record<string, unknown>
    const row: Record<string, unknown> = {}
    for (const k of keys) {
      const v = FIELD_EXTRACTORS[k]!(a)
      row[k] = typeof v === 'string' || typeof v === 'number' ? v : formatCell(v)
    }
    if (keys.includes('activity_id')) {
      row.clio_activity_id = a.id ?? ''
    }
    return row
  })

  return { columns, records }
}
