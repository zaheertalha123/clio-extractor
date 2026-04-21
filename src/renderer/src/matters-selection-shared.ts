/** Shared types / HTML snippets for matter pickers (each page keeps its own selection state). */
export type MatterPickerRow = {
  id: number
  display_number: string
  description: string | null
}

/** Same options as Firm Revenue → Matter Status */
export const MATTER_STATUS_OPTIONS_HTML = [
  '<option value="">All statuses</option>',
  '<option value="Open">Open</option>',
  '<option value="Pending">Pending</option>',
  '<option value="Closed">Closed</option>'
].join('')
