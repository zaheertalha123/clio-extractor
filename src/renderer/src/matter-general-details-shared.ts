/** General-detail checkboxes: keys must match `MATTER_GENERAL_DETAIL_FIELD_MAP` in main/api/matters/matter-general-details-fetch.ts */
export const MATTER_GENERAL_DETAIL_OPTIONS: ReadonlyArray<{
  key: string
  label: string
  defaultChecked: boolean
}> = [
  { key: 'description', label: 'Matter description', defaultChecked: true },
  { key: 'responsible_attorney', label: 'Responsible attorney', defaultChecked: true },
  { key: 'responsible_staff', label: 'Responsible staff', defaultChecked: false },
  { key: 'blocked_users', label: 'Blocked users', defaultChecked: false },
  { key: 'originating_attorney', label: 'Originating attorney', defaultChecked: true },
  { key: 'practice_area', label: 'Practice area', defaultChecked: true },
  { key: 'matter_stage', label: 'Matter stage', defaultChecked: false },
  { key: 'client_reference', label: 'Client reference number', defaultChecked: false },
  { key: 'location', label: 'Location', defaultChecked: true },
  { key: 'status', label: 'Status', defaultChecked: true },
  { key: 'open_date', label: 'Open date', defaultChecked: true },
  { key: 'pending_date', label: 'Pending date', defaultChecked: false },
  { key: 'close_date', label: 'Closed date', defaultChecked: false },
  { key: 'limitations_date', label: 'Limitations date', defaultChecked: false },
  { key: 'billable', label: 'Billable', defaultChecked: true },
  { key: 'custom_rates', label: 'Custom Rates', defaultChecked: false },
  { key: 'maildrop_address', label: 'Maildrop address', defaultChecked: true }
]

export function buildMatterGeneralDetailsCheckboxesHtml(
  escapeHtml: (s: string) => string,
  opts: { checkboxClass: string; rowClass: string }
): string {
  const { checkboxClass, rowClass } = opts
  return MATTER_GENERAL_DETAIL_OPTIONS.map(
    (o) =>
      `<label class="rr-cf-field-row ${rowClass}"><input type="checkbox" class="${checkboxClass}" data-gd-key="${o.key}" ${
        o.defaultChecked ? 'checked' : ''
      } /><span class="rr-cf-field-name">${escapeHtml(o.label)}</span></label>`
  ).join('')
}
