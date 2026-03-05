import type { SchemaField } from './types'
import { escapeHtml } from './utils'
import { SCHEMA_TILES, SCHEMA_FILES, getFieldsForEntity } from './data'
import { buildSchemaTreeHtml, attachSchemaTreeListeners } from './tree-view'
import matterImg from '../../assets/matter.png'
import activityImg from '../../assets/activity.png'
import billImg from '../../assets/bill.png'

const TILE_IMAGE: Record<string, string> = {
  Matters: matterImg,
  Activities: activityImg,
  Bill: billImg
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
        showSchemaDetailView(item, name, onBackToTiles)
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
