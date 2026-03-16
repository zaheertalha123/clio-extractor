import type { SchemaField } from './types'
import { escapeHtml } from './utils'
import { SCHEMA_TILES, SCHEMA_FILES, getFieldsForEntity } from './data'
import { buildSchemaTreeHtml, attachSchemaTreeListeners, fillSchemaFetchedValues, attachSchemaValueExpandListeners } from './tree-view'
import matterImg from '../../assets/matter.png'
import activityImg from '../../assets/activity.png'
import billImg from '../../assets/bill.png'
import customFieldsImg from '../../assets/custom-fields.png'

const TILE_IMAGE: Record<string, string> = {
  Matters: matterImg,
  Activities: activityImg,
  Bill: billImg,
  'Custom Fields': customFieldsImg
}

function getTileImage(tileName: string): string {
  return TILE_IMAGE[tileName] ?? matterImg
}

export function getSchemaPageHtml(): string {
  const cardsHtml = SCHEMA_TILES.map(
    (tile, tileIndex) => {
      const imgSrc = getTileImage(tile.name)
      return `
    <button type="button" class="schema-card" data-tile-index="${tileIndex}" data-tile-name="${escapeAttr(tile.name)}">
      <img class="schema-card-img" src="${escapeAttr(imgSrc)}" alt="" />
      <span class="schema-card-title">${escapeHtml(tile.name)}</span>
    </button>
  `
    }
  ).join('')
  return `
    <div class="schema-page">
      <div class="page-header">
        <h1 class="page-title">Schema</h1>
        <p class="page-description">Click a card to open its schema options.</p>
      </div>
      <div class="schema-cards-grid">
        ${cardsHtml}
      </div>
      <div id="schema-dialog-overlay" class="schema-dialog-overlay" hidden aria-hidden="true">
        <div class="schema-dialog" role="dialog" aria-modal="true" aria-labelledby="schema-dialog-title">
          <div class="schema-dialog-header">
            <h2 id="schema-dialog-title" class="schema-dialog-title"></h2>
            <button type="button" class="schema-dialog-close" aria-label="Close">×</button>
          </div>
          <div class="schema-dialog-body">
            <div id="schema-dialog-items"></div>
          </div>
        </div>
      </div>
    </div>
  `
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;')
}

/** Keys to exclude from schema CSV export (e.g. id, etag) at any nesting level. */
const SCHEMA_CSV_EXCLUDE_KEYS = ['id', 'etag']

function formatCsvValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return JSON.stringify(value)
  return String(value)
}

/**
 * Build CSV rows from schema data (Matter, Activity, Bill, etc.) in schema field order: Field name, Fetched data.
 * Excludes id, etag at all levels. Single objects flattened as parent-child. Arrays use first item only, first level.
 */
function buildSchemaCsvRows(data: Record<string, unknown>, schemaFields: SchemaField[]): Array<[string, string]> {
  const rows: Array<[string, string]> = [['Field name', 'Fetched data']]
  for (const field of schemaFields) {
    if (SCHEMA_CSV_EXCLUDE_KEYS.includes(field.name)) continue
    const value = data[field.name]
    if (value === null || value === undefined) {
      rows.push([field.name, ''])
      continue
    }
    if (typeof value !== 'object') {
      rows.push([field.name, String(value)])
      continue
    }
    if (Array.isArray(value)) {
      const first = value[0]
      if (first === undefined) {
        rows.push([field.name, ''])
        continue
      }
      if (typeof first !== 'object' || first === null) {
        rows.push([field.name, formatCsvValue(first)])
        continue
      }
      const firstObj = first as Record<string, unknown>
      const nestedOrder = field.fields && field.fields.length > 0 ? field.fields : Object.keys(firstObj)
      for (const k of nestedOrder) {
        const subName = typeof k === 'string' ? k : (k as SchemaField).name
        if (SCHEMA_CSV_EXCLUDE_KEYS.includes(subName)) continue
        const v = firstObj[subName]
        rows.push([`${field.name}-${subName}`, formatCsvValue(v)])
      }
      continue
    }
    const obj = value as Record<string, unknown>
    const nestedOrder = field.fields && field.fields.length > 0 ? field.fields.map((f) => f.name) : Object.keys(obj)
    for (const k of nestedOrder) {
      if (SCHEMA_CSV_EXCLUDE_KEYS.includes(k)) continue
      const v = obj[k]
      rows.push([`${field.name}-${k}`, formatCsvValue(v)])
    }
  }
  return rows
}

function escapeCsvCell(cell: string): string {
  if (!/[\n",]/.test(cell)) return cell
  return `"${cell.replace(/"/g, '""')}"`
}

function buildSchemaCsvContent(data: Record<string, unknown>, schemaFields: SchemaField[]): string {
  const rows = buildSchemaCsvRows(data, schemaFields)
  return rows.map(([name, value]) => `${escapeCsvCell(name)},${escapeCsvCell(value)}`).join('\n')
}

function getSchemaDetailPageHtml(entityName: string, fields: SchemaField[]): string {
  const treeHtml = buildSchemaTreeHtml(fields)
  const isActivity = entityName === 'Activity'
  const isBills = entityName === 'Bills'
  const activityIdsBlock = isActivity
    ? `
      <div id="schema-activity-ids-wrap" class="activity-ids-wrap" hidden>
        <div class="activity-ids-scroll" id="schema-activity-ids-scroll"></div>
      </div>`
    : ''
  const billsBlock = isBills
    ? `
      <div id="schema-bills-wrap" class="activity-ids-wrap" hidden>
        <div class="activity-ids-scroll" id="schema-bills-scroll"></div>
      </div>`
    : ''
  const descriptionSuffix = isActivity
    ? ' Enter a matter number and click Fetch to load activity IDs (latest first).'
    : isBills
      ? ' Enter a matter number and click Fetch to load bills for that matter (latest issued first).'
      : ''
  const exportCsvToolbar = `<div class="schema-tree-toolbar"><span></span><button type="button" id="schema-export-csv-btn" class="schema-export-csv-btn" disabled>Export CSV</button></div>`
  return `
    <div class="schema-detail-page">
      <div class="schema-detail-header">
        <button type="button" id="schema-detail-back" class="schema-back-btn" aria-label="Back to schema tiles">← Back</button>
        <h1 class="page-title schema-detail-title">${escapeHtml(entityName)}</h1>
        <p class="page-description">Field structure with nesting. Expand nodes to see nested fields.${descriptionSuffix}</p>
      </div>
      <div class="schema-fetch-bar">
        <label for="schema-matter-number" class="schema-fetch-label">Matter number</label>
        <input type="text" id="schema-matter-number" class="schema-matter-input" placeholder="e.g. 16420.001" />
        <button type="button" id="schema-fetch-btn" class="schema-fetch-btn">Fetch</button>
        <span id="schema-fetch-message" class="schema-fetch-message" aria-live="polite"></span>
      </div>
      ${activityIdsBlock}
      ${billsBlock}
      <div class="schema-tree-wrap">
        ${exportCsvToolbar}
        <div class="schema-tree-header">
          <span class="schema-tree-header-spacer"></span>
          <span class="schema-tree-header-name">Name</span>
          <span class="schema-tree-header-type">Type</span>
          <span class="schema-tree-header-value">Fetched Data</span>
        </div>
        ${treeHtml}
      </div>
      <div id="schema-value-popover" class="schema-tree-value-popover" hidden role="dialog" aria-label="List or object content"></div>
    </div>
  `
}

function showSchemaDetailView(entityName: string, tileName: string, onBack: () => void): void {
  const content = document.getElementById('page-content')
  if (!content) return

  const fields = getFieldsForEntity(tileName, entityName)
  if (!fields) {
    content.innerHTML = `
      <div class="schema-detail-page">
        <div class="schema-detail-header">
          <button type="button" id="schema-detail-back" class="schema-back-btn">← Back</button>
          <h1 class="page-title">${escapeHtml(entityName)}</h1>
        </div>
        <p class="text">${SCHEMA_FILES[tileName] ? `Schema not found for "${escapeHtml(entityName)}".` : 'Schema not yet defined for this resource.'}</p>
      </div>
    `
    content.querySelector('#schema-detail-back')?.addEventListener('click', onBack)
    return
  }

  content.innerHTML = getSchemaDetailPageHtml(entityName, fields)
  content.querySelector('#schema-detail-back')?.addEventListener('click', onBack)

  const treeWrap = content.querySelector('.schema-tree-wrap')
  if (treeWrap) attachSchemaTreeListeners(treeWrap as HTMLElement)

  const popoverEl = content.querySelector('#schema-value-popover')
  if (treeWrap && popoverEl) attachSchemaValueExpandListeners(treeWrap as HTMLElement, popoverEl as HTMLElement)

  const fetchBtn = content.querySelector('#schema-fetch-btn')
  const matterInput = content.querySelector<HTMLInputElement>('#schema-matter-number')
  const messageEl = content.querySelector('#schema-fetch-message')
  const isActivity = entityName === 'Activity'
  const isBills = entityName === 'Bills'
  const activityIdsWrap = content.querySelector('#schema-activity-ids-wrap')
  const activityIdsScroll = content.querySelector('#schema-activity-ids-scroll')
  const billsWrap = content.querySelector('#schema-bills-wrap')
  const billsScroll = content.querySelector('#schema-bills-scroll')

  let lastFetchedData: Record<string, unknown> | null = null

  if (fetchBtn && matterInput && messageEl) {
    fetchBtn.addEventListener('click', async () => {
      const matterNumber = matterInput.value.trim()
      if (!matterNumber) {
        messageEl.textContent = 'Enter a matter number.'
        if (isActivity && activityIdsWrap) (activityIdsWrap as HTMLElement).hidden = true
        if (isBills && billsWrap) (billsWrap as HTMLElement).hidden = true
        return
      }
      ;(fetchBtn as HTMLButtonElement).disabled = true
      messageEl.textContent = 'Fetching…'
      if (isActivity && activityIdsWrap) (activityIdsWrap as HTMLElement).hidden = true
      if (isBills && billsWrap) (billsWrap as HTMLElement).hidden = true

      try {
        if (isActivity) {
          const api = (window as Window & { api?: { clio?: { fetchActivityIdsByMatterDisplayNumber: (n: string) => Promise<{ data: Array<{ id: number; note?: string }>; error?: string }> } } }).api
          if (!api?.clio?.fetchActivityIdsByMatterDisplayNumber) {
            messageEl.textContent = 'API not available.'
            return
          }
          const { data, error } = await api.clio.fetchActivityIdsByMatterDisplayNumber(matterNumber)
          if (error) {
            messageEl.textContent = error
            return
          }
          if (!data || data.length === 0) {
            messageEl.textContent = 'No activities found for this matter.'
            return
          }
          messageEl.textContent = `${data.length} activity ID${data.length === 1 ? '' : 's'} (latest first). Click an ID to load its data below.`
          if (activityIdsScroll) {
            activityIdsScroll.innerHTML = data
              .map((a) => {
                const noteStr = a.note != null ? String(a.note) : ''
                const notePreview = noteStr.slice(0, 20)
                const label = notePreview ? `${a.id} – ${escapeHtml(notePreview)}${noteStr.length > 20 ? '…' : ''}` : String(a.id)
                return `<button type="button" class="activity-id-chip" data-activity-id="${a.id}">${label}</button>`
              })
              .join('')
          }
          if (activityIdsWrap) (activityIdsWrap as HTMLElement).hidden = false
        } else if (isBills) {
          const api = (window as Window & { api?: { clio?: { fetchBillsByMatterDisplayNumber: (n: string) => Promise<{ data: Array<{ id: number; number?: string; type?: string }>; error?: string }> } } }).api
          if (!api?.clio?.fetchBillsByMatterDisplayNumber) {
            messageEl.textContent = 'API not available.'
            return
          }
          const { data, error } = await api.clio.fetchBillsByMatterDisplayNumber(matterNumber)
          if (error) {
            messageEl.textContent = error
            return
          }
          if (!data || data.length === 0) {
            messageEl.textContent = 'No bills found for this matter.'
            return
          }
          messageEl.textContent = `${data.length} bill${data.length === 1 ? '' : 's'} (latest issued first).`
          if (billsScroll) {
            billsScroll.innerHTML = data
              .map((b) => {
                const invoiceNumber = b.number != null ? String(b.number) : '—'
                const typeStr = b.type != null ? String(b.type) : ''
                const label = `Invoice: ${escapeHtml(invoiceNumber)}${typeStr ? ` (${escapeHtml(typeStr)})` : ''}`
                return `<button type="button" class="activity-id-chip" data-bill-id="${b.id}" title="ID: ${b.id}, Invoice: ${escapeAttr(invoiceNumber)}, Type: ${escapeAttr(typeStr)}">${label}</button>`
              })
              .join('')
          }
          if (billsWrap) (billsWrap as HTMLElement).hidden = false
        } else {
          const api = (window as Window & { api?: { clio?: { fetchMatterByDisplayNumber: (n: string) => Promise<{ data: Record<string, unknown> | null; error?: string }> } } }).api
          if (!api?.clio?.fetchMatterByDisplayNumber) {
            messageEl.textContent = 'API not available.'
            return
          }
          const { data, error } = await api.clio.fetchMatterByDisplayNumber(matterNumber)
          if (error) {
            messageEl.textContent = error
            return
          }
          if (data && treeWrap) {
            lastFetchedData = data
            fillSchemaFetchedValues(treeWrap as HTMLElement, data)
            messageEl.textContent = ''
            const exportCsvBtn = content.querySelector<HTMLButtonElement>('#schema-export-csv-btn')
            if (exportCsvBtn) exportCsvBtn.disabled = false
          } else {
            messageEl.textContent = 'No matter data returned.'
          }
        }
      } finally {
        ;(fetchBtn as HTMLButtonElement).disabled = false
      }
    })
  }

  const exportCsvBtn = content.querySelector<HTMLButtonElement>('#schema-export-csv-btn')
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', async () => {
      if (!lastFetchedData) return
      const csvContent = buildSchemaCsvContent(lastFetchedData, fields)
      const defaultName = `${entityName.toLowerCase().replace(/\s+/g, '-')}-export.csv`
      const api = (window as Window & { api?: { results?: { saveCsv: (content: string, defaultName?: string) => Promise<{ success: boolean; path?: string }> } } }).api
      if (api?.results?.saveCsv) {
        await api.results.saveCsv(csvContent, defaultName)
      }
    })
  }

  if (isActivity && activityIdsScroll && treeWrap && messageEl) {
    activityIdsScroll.addEventListener('click', async (e) => {
      const chip = (e.target as HTMLElement).closest('.activity-id-chip')
      if (!chip) return
      const idStr = (chip as HTMLElement).dataset.activityId
      if (!idStr) return
      const id = Number(idStr)
      if (Number.isNaN(id)) return
      const api = (window as Window & { api?: { clio?: { fetchActivityById: (n: number) => Promise<{ data: Record<string, unknown> | null; error?: string }> } } }).api
      if (!api?.clio?.fetchActivityById) {
        messageEl.textContent = 'API not available.'
        return
      }
      messageEl.textContent = 'Loading activity…'
      try {
        const { data, error } = await api.clio.fetchActivityById(id)
        if (error) {
          messageEl.textContent = error
          return
        }
        if (data) {
          lastFetchedData = data
          fillSchemaFetchedValues(treeWrap as HTMLElement, data)
          messageEl.textContent = ''
          const exportCsvBtn = content.querySelector<HTMLButtonElement>('#schema-export-csv-btn')
          if (exportCsvBtn) exportCsvBtn.disabled = false
        } else {
          messageEl.textContent = 'No activity data returned.'
        }
      } finally {
        messageEl.textContent = messageEl.textContent || ''
      }
    })
  }

  if (isBills && billsScroll && treeWrap && messageEl) {
    billsScroll.addEventListener('click', async (e) => {
      const chip = (e.target as HTMLElement).closest('.activity-id-chip[data-bill-id]')
      if (!chip) return
      const idStr = (chip as HTMLElement).dataset.billId
      if (!idStr) return
      const id = Number(idStr)
      if (Number.isNaN(id)) return
      const api = (window as Window & { api?: { clio?: { fetchBillById: (n: number) => Promise<{ data: Record<string, unknown> | null; error?: string }> } } }).api
      if (!api?.clio?.fetchBillById) {
        messageEl.textContent = 'API not available.'
        return
      }
      messageEl.textContent = 'Loading bill…'
      try {
        const { data, error } = await api.clio.fetchBillById(id)
        if (error) {
          messageEl.textContent = error
          return
        }
        if (data) {
          lastFetchedData = data
          fillSchemaFetchedValues(treeWrap as HTMLElement, data)
          messageEl.textContent = ''
          const exportCsvBtn = content.querySelector<HTMLButtonElement>('#schema-export-csv-btn')
          if (exportCsvBtn) exportCsvBtn.disabled = false
        } else {
          messageEl.textContent = 'No bill data returned.'
        }
      } finally {
        messageEl.textContent = messageEl.textContent || ''
      }
    })
  }
}

function openSchemaDialog(tileIndex: string, onBackToTiles: () => void): void {
  const overlay = document.getElementById('schema-dialog-overlay')
  const titleEl = document.getElementById('schema-dialog-title')
  const itemsEl = document.getElementById('schema-dialog-items')
  if (!overlay || !titleEl || !itemsEl) return

  const tile = SCHEMA_TILES[parseInt(tileIndex, 10)]
  if (!tile) return

  titleEl.textContent = tile.name
  itemsEl.innerHTML = tile.items
    .map((item) => `<button type="button" class="schema-dialog-item" data-tile-name="${escapeAttr(tile.name)}" data-item="${escapeAttr(item)}">${escapeHtml(item)}</button>`)
    .join('')

  overlay.hidden = false
  overlay.removeAttribute('aria-hidden')

  itemsEl.querySelectorAll('.schema-dialog-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = (btn as HTMLElement).dataset.tileName
      const item = (btn as HTMLElement).dataset.item
      if (name && item) {
        closeSchemaDialog()
        if (name === 'Custom Fields' && (item === 'Contact' || item === 'Matter')) {
          showCustomFieldsView(item as 'Contact' | 'Matter', onBackToTiles)
        } else {
          showSchemaDetailView(item, name, onBackToTiles)
        }
      }
    })
  })
}

function closeSchemaDialog(): void {
  const overlay = document.getElementById('schema-dialog-overlay')
  if (overlay) {
    overlay.hidden = true
    overlay.setAttribute('aria-hidden', 'true')
  }
}

function getPicklistOptions(f: Record<string, unknown>): string[] {
  const opts = f.picklist_options
  if (!Array.isArray(opts)) return []
  return opts
    .map((o: unknown) => (o != null && typeof o === 'object' && 'option' in o ? String((o as { option: unknown }).option ?? '') : ''))
    .filter(Boolean)
}

function getCustomFieldsExportToolbarHtml(): string {
  return `<div class="schema-tree-toolbar custom-fields-export-toolbar"><span></span><button type="button" id="custom-fields-export-csv-btn" class="schema-export-csv-btn" disabled>Export CSV</button></div>`
}

function buildCustomFieldsCsvContent(rows: Array<{ fieldName: string; value: string }>): string {
  const header = 'Field name,Fetched data'
  const body = rows.map((r) => `${escapeCsvCell(r.fieldName)},${escapeCsvCell(r.value)}`).join('\n')
  return `${header}\n${body}`
}

function getCustomFieldsTableHtml(fields: Array<Record<string, unknown>>): string {
  const rows = fields
    .map((f) => {
      const name = String(f.name ?? '')
      const fieldId = f.id != null ? String(f.id) : ''
      const isPicklist = f.field_type === 'picklist'
      const options = getPicklistOptions(f)
      const hasOptions = isPicklist && options.length > 0
      const optionsAttr = hasOptions ? escapeAttr(JSON.stringify(options)) : ''
      const nameCell = hasOptions
        ? `<span class="custom-field-name-cell"><span class="custom-field-name-text">${escapeHtml(name)}</span><span class="picklist-info-icon" data-options="${optionsAttr}" aria-label="Show picklist options">ⓘ</span></span>`
        : escapeHtml(name)
      return `
    <tr>
      <td>${nameCell}</td>
      <td>${escapeHtml(String(f.field_type ?? ''))}</td>
      <td>${f.displayed === true ? 'Yes' : 'No'}</td>
      <td>${f.deleted === true ? 'Yes' : 'No'}</td>
      <td>${f.required === true ? 'Yes' : 'No'}</td>
      <td class="custom-field-fetched-value" data-custom-field-id="${escapeAttr(fieldId)}"></td>
    </tr>
  `
    })
    .join('')
  return `
    <table class="custom-fields-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Field type</th>
          <th>Displayed</th>
          <th>Deleted</th>
          <th>Required</th>
          <th>Fetched Data</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div id="custom-fields-picklist-tooltip" class="picklist-options-tooltip" role="tooltip" hidden></div>
  `
}

function showCustomFieldsView(parentType: 'Contact' | 'Matter', onBack: () => void): void {
  const content = document.getElementById('page-content')
  if (!content) return

  const fetchLabel = parentType === 'Matter' ? 'Matter number' : 'Contact'
  const fetchPlaceholder = parentType === 'Matter' ? 'e.g. 16420.001 or matter ID' : 'e.g. contact ID or name'
  content.innerHTML = `
    <div class="schema-detail-page custom-fields-detail">
      <div class="schema-detail-header">
        <button type="button" id="schema-detail-back" class="schema-back-btn" aria-label="Back">← Back</button>
        <h1 class="page-title schema-detail-title">Custom Fields — ${escapeHtml(parentType)}</h1>
        <p class="page-description">Loading custom fields from API…</p>
      </div>
      <div class="schema-fetch-bar custom-fields-fetch-bar">
        <label for="custom-fields-entity-input" class="schema-fetch-label">${escapeHtml(fetchLabel)}</label>
        <input type="text" id="custom-fields-entity-input" class="schema-matter-input" placeholder="${escapeAttr(fetchPlaceholder)}" />
        <button type="button" id="custom-fields-fetch-btn" class="schema-fetch-btn">Fetch</button>
        <span id="custom-fields-fetch-message" class="schema-fetch-message" aria-live="polite"></span>
      </div>
      <div id="custom-fields-content"></div>
    </div>
  `
  content.querySelector('#schema-detail-back')?.addEventListener('click', onBack)

  const container = document.getElementById('custom-fields-content')
  if (!container) return

  void (async () => {
    const api = (window as Window & { api?: { clio?: { fetchCustomFields: (p: 'Contact' | 'Matter') => Promise<{ data: Array<Record<string, unknown>>; error?: string }>; fetchMatterByDisplayNumber: (n: string) => Promise<{ data: Record<string, unknown> | null; error?: string }> } } }).api
    if (!api?.clio?.fetchCustomFields) {
      container.innerHTML = '<p class="text">API not available.</p>'
      const desc = content.querySelector('.schema-detail-header .page-description')
      if (desc) desc.textContent = ''
      return
    }

    const { data, error } = await api.clio.fetchCustomFields(parentType)
    const desc = content.querySelector('.schema-detail-header .page-description')
    if (desc) desc.textContent = ''

    if (error) {
      container.innerHTML = `<p class="text error">${escapeHtml(error)}</p>`
      return
    }
    if (!data || data.length === 0) {
      container.innerHTML = '<p class="text">No custom fields found.</p>'
      return
    }
    container.innerHTML = getCustomFieldsExportToolbarHtml() + getCustomFieldsTableHtml(data)
    attachPicklistTooltipListeners(container)

    let lastFetchedCustomFieldsData: Array<{ fieldName: string; value: string }> | null = null

    const exportCsvBtn = container.querySelector<HTMLButtonElement>('#custom-fields-export-csv-btn')
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', async () => {
        if (!lastFetchedCustomFieldsData) return
        const csvContent = buildCustomFieldsCsvContent(lastFetchedCustomFieldsData)
        const defaultName = `custom-fields-${parentType.toLowerCase()}-export.csv`
        const resultsApi = (window as Window & { api?: { results?: { saveCsv: (content: string, defaultName?: string) => Promise<{ success: boolean; path?: string }> } } }).api
        if (resultsApi?.results?.saveCsv) {
          await resultsApi.results.saveCsv(csvContent, defaultName)
        }
      })
    }

    const fetchBtn = content.querySelector('#custom-fields-fetch-btn')
    const entityInput = content.querySelector<HTMLInputElement>('#custom-fields-entity-input')
    const messageEl = content.querySelector('#custom-fields-fetch-message')
    const customFieldIds = data.map((f) => Number(f.id)).filter((n) => !Number.isNaN(n))
    const fetchValues =
      parentType === 'Matter'
        ? api.clio.fetchMatterCustomFieldValues
        : api.clio.fetchContactCustomFieldValues
    if (fetchBtn && entityInput && messageEl && fetchValues) {
      fetchBtn.addEventListener('click', async () => {
        const identifier = entityInput.value.trim()
        if (!identifier) {
          messageEl.textContent = parentType === 'Matter' ? 'Enter a matter number or matter ID.' : 'Enter a contact ID or name.'
          return
        }
        ;(fetchBtn as HTMLButtonElement).disabled = true
        messageEl.textContent = 'Fetching…'
        try {
          const result = await fetchValues(identifier, customFieldIds)
          if (result.error) {
            messageEl.textContent = result.error
            return
          }
          const values = result.data
          const valueByFieldId: Record<string, string> = {}
          for (const cv of values) {
            const cf = cv.custom_field as { id?: number } | undefined
            const cfId = cf?.id
            if (cfId == null) continue
            let displayValue: string = cv.value != null ? String(cv.value) : ''
            const fieldDef = data.find((f) => Number(f.id) === cfId)
            if (fieldDef?.field_type === 'picklist' && cv.value != null) {
              const opts = fieldDef.picklist_options
              if (Array.isArray(opts)) {
                const selected = opts.find(
                  (o: unknown) =>
                    o != null &&
                    typeof o === 'object' &&
                    'id' in o &&
                    (Number((o as { id: unknown }).id) === Number(cv.value) || (o as { id: unknown }).id === cv.value)
                )
                if (selected != null && typeof selected === 'object' && 'option' in selected) {
                  displayValue = String((selected as { option: unknown }).option ?? '')
                }
              }
            }
            valueByFieldId[String(cfId)] = displayValue
          }
          lastFetchedCustomFieldsData = data.map((f) => ({
            fieldName: String(f.name ?? ''),
            value: valueByFieldId[String(f.id)] ?? ''
          }))
          container.querySelectorAll<HTMLElement>('.custom-field-fetched-value[data-custom-field-id]').forEach((cell) => {
            const id = cell.getAttribute('data-custom-field-id')
            cell.textContent = id ? (valueByFieldId[id] ?? '') : ''
          })
          messageEl.textContent = ''
          if (exportCsvBtn) exportCsvBtn.disabled = false
        } finally {
          ;(fetchBtn as HTMLButtonElement).disabled = false
        }
      })
    }
  })()
}

function attachPicklistTooltipListeners(container: HTMLElement): void {
  const tooltip = container.querySelector('#custom-fields-picklist-tooltip') as HTMLElement | null
  if (!tooltip) return

  container.querySelectorAll('.picklist-info-icon').forEach((iconEl) => {
    const icon = iconEl as HTMLElement
    const optionsJson = icon.getAttribute('data-options')
    let options: string[] = []
    try {
      if (optionsJson) options = JSON.parse(optionsJson) as string[]
    } catch {
      options = []
    }

    icon.addEventListener('mouseenter', () => {
      if (options.length === 0) return
      const html = `<div class="picklist-options-tooltip-title">Picklist options (${options.length})</div><ul class="picklist-options-tooltip-list">${options.map((opt) => `<li>${escapeHtml(opt)}</li>`).join('')}</ul>`
      tooltip.innerHTML = html
      tooltip.hidden = false
      const rect = icon.getBoundingClientRect()
      tooltip.style.left = `${rect.left}px`
      tooltip.style.top = `${rect.bottom + 6}px`
      requestAnimationFrame(() => {
        const tr = tooltip.getBoundingClientRect()
        let left = rect.left
        let top = rect.bottom + 6
        if (left + tr.width > window.innerWidth - 8) left = window.innerWidth - tr.width - 8
        if (left < 8) left = 8
        if (top + tr.height > window.innerHeight - 8) top = rect.top - tr.height - 6
        if (top < 8) top = 8
        tooltip.style.left = `${left}px`
        tooltip.style.top = `${top}px`
      })
    })

    icon.addEventListener('mouseleave', () => {
      tooltip.hidden = true
    })
  })

  tooltip.addEventListener('mouseenter', () => {
    tooltip.hidden = false
  })
  tooltip.addEventListener('mouseleave', () => {
    tooltip.hidden = true
  })
}

export function setupSchemaListeners(onBackToTiles: () => void): void {
  const content = document.getElementById('page-content')
  if (!content) return

  content.querySelectorAll('.schema-card').forEach((card) => {
    card.addEventListener('click', () => {
      const tileIndex = (card as HTMLElement).dataset.tileIndex
      if (tileIndex != null) openSchemaDialog(tileIndex, onBackToTiles)
    })
  })

  const overlay = content.querySelector('#schema-dialog-overlay')
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeSchemaDialog()
  })
  content.querySelector('.schema-dialog-close')?.addEventListener('click', closeSchemaDialog)
}
