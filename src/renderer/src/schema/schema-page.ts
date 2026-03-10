import type { SchemaField } from './types'
import { escapeHtml } from './utils'
import { SCHEMA_TILES, SCHEMA_FILES, getFieldsForEntity } from './data'
import { buildSchemaTreeHtml, attachSchemaTreeListeners } from './tree-view'
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

function getSchemaDetailPageHtml(entityName: string, fields: SchemaField[]): string {
  const treeHtml = buildSchemaTreeHtml(fields)
  return `
    <div class="schema-detail-page">
      <div class="schema-detail-header">
        <button type="button" id="schema-detail-back" class="schema-back-btn" aria-label="Back to schema tiles">← Back</button>
        <h1 class="page-title schema-detail-title">${escapeHtml(entityName)}</h1>
        <p class="page-description">Field structure with nesting. Expand nodes to see nested fields.</p>
      </div>
      <div class="schema-tree-wrap">
        ${treeHtml}
      </div>
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

function getCustomFieldsTableHtml(fields: Array<Record<string, unknown>>): string {
  const rows = fields
    .map((f) => {
      const name = String(f.name ?? '')
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

  content.innerHTML = `
    <div class="schema-detail-page custom-fields-detail">
      <div class="schema-detail-header">
        <button type="button" id="schema-detail-back" class="schema-back-btn" aria-label="Back">← Back</button>
        <h1 class="page-title schema-detail-title">Custom Fields — ${escapeHtml(parentType)}</h1>
        <p class="page-description">Loading custom fields from API…</p>
      </div>
      <div id="custom-fields-content"></div>
    </div>
  `
  content.querySelector('#schema-detail-back')?.addEventListener('click', onBack)

  const container = document.getElementById('custom-fields-content')
  if (!container) return

  void (async () => {
    const api = (window as Window & { api?: { clio?: { fetchCustomFields: (p: 'Contact' | 'Matter') => Promise<{ data: Array<Record<string, unknown>>; error?: string }> } } }).api
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
    container.innerHTML = getCustomFieldsTableHtml(data)
    attachPicklistTooltipListeners(container)
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
