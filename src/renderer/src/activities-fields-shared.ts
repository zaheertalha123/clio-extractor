export const ACTIVITY_FIELD_OPTIONS: ReadonlyArray<{
  key: string
  label: string
  defaultChecked: boolean
}> = [
  { key: 'matter_id', label: 'Matter ID', defaultChecked: true },
  { key: 'matter_description', label: 'Matter Description', defaultChecked: true },
  { key: 'activity_id', label: 'Activity ID', defaultChecked: true },
  { key: 'type', label: 'Type', defaultChecked: true },
  { key: 'description', label: 'Description', defaultChecked: true },
  { key: 'activity_category', label: 'Activity Category', defaultChecked: true },
  { key: 'quantity', label: 'Quantity', defaultChecked: true },
  { key: 'client_name', label: 'Client Name', defaultChecked: true },
  { key: 'user_name', label: 'User Name', defaultChecked: true },
  { key: 'date', label: 'Date', defaultChecked: true },
  { key: 'rate', label: 'Rate', defaultChecked: true },
  { key: 'billable', label: 'Billable', defaultChecked: true },
  { key: 'non_billable', label: 'Non Billable', defaultChecked: true },
  { key: 'invoice_status', label: 'Invoice Status', defaultChecked: true },
  { key: 'invoice_number', label: 'Invoice Number', defaultChecked: true },
  { key: 'bill_status', label: 'Bill Status', defaultChecked: false }
]

export function buildActivityFieldCheckboxesHtml(
  escapeHtml: (s: string) => string
): string {
  return ACTIVITY_FIELD_OPTIONS.map(
    (o) =>
      `<label class="rr-cf-field-row act-field-row"><input type="checkbox" class="act-field-cb" data-act-field-key="${escapeHtml(o.key)}" ${
        o.defaultChecked ? 'checked' : ''
      } /><span class="rr-cf-field-name">${escapeHtml(o.label)}</span></label>`
  ).join('')
}
