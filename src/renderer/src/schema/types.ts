/**
 * Schema field with optional nested fields (any depth).
 */
export interface SchemaField {
  name: string
  type: string
  fields?: SchemaField[]
}

/**
 * Schema file shape: entity name -> array of fields.
 */
export type SchemaEntityMap = Record<string, SchemaField[]>
