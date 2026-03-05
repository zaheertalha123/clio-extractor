import type { SchemaEntityMap, SchemaField } from './types'
import mattersSchema from '../../assets/schemas/matters.json'
import clientSchema from '../../assets/schemas/client.json'
import activitySchema from '../../assets/schemas/activity.json'
import billSchema from '../../assets/schemas/bill.json'

export const SCHEMA_TILES: Array<{ name: string; items: string[] }> = [
  {
    name: 'Matters',
    items: [
      'Matter', 'Relationships', 'Clients', 'Related Contacts', 'Matter Contacts', 'Notes',
      'Practice Areas', 'Log Entries', 'Matter Stages', 'Medical Records Details', 'Medical Records',
      'Medical Bills', 'Damages'
    ]
  },
  {
    name: 'Activities',
    items: [
      'Activity', 'Activity Description', 'Activity Rates', 'Expense Categories', 'Timers',
      'Utbms Codes', 'Utbms Sets'
    ]
  },
  {
    name: 'Bill',
    items: [
      'Bills', 'Billable Clients', 'Billable Matters', 'Interest Charges', 'Outstanding Client Balances'
    ]
  }
]

export const SCHEMA_FILES: Record<string, string> = {
  Matters: 'matters.json'
}

/** Sub-menu item -> { file, entityKey } when schema lives in a separate file */
const ENTITY_FILE_MAP: Record<string, { file: string; entityKey: string }> = {
  Clients: { file: 'client.json', entityKey: 'Client' },
  Activity: { file: 'activity.json', entityKey: 'Activity' },
  Bills: { file: 'bill.json', entityKey: 'Bill' },
  'Billable Clients': { file: 'bill.json', entityKey: 'BillableClient' },
  'Billable Matters': { file: 'bill.json', entityKey: 'BillableMatter' },
  'Interest Charges': { file: 'bill.json', entityKey: 'InterestCharge' },
  'Outstanding Client Balances': { file: 'bill.json', entityKey: 'OutstandingClientBalance' }
}

export const SCHEMA_DATA: Record<string, SchemaEntityMap> = {
  'matters.json': mattersSchema as SchemaEntityMap,
  'client.json': clientSchema as SchemaEntityMap,
  'activity.json': activitySchema as SchemaEntityMap,
  'bill.json': billSchema as SchemaEntityMap
}

export function getFieldsForEntity(tileName: string, entityName: string): SchemaField[] | null {
  const override = ENTITY_FILE_MAP[entityName]
  const schemaFile = override ? override.file : SCHEMA_FILES[tileName]
  const entityKey = override ? override.entityKey : entityName
  if (!schemaFile) return null
  const data = SCHEMA_DATA[schemaFile]
  const fields = data?.[entityKey]
  return Array.isArray(fields) ? fields : null
}
