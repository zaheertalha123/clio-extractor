import type { SchemaField } from './types'
import { escapeHtml } from './utils'

const HAS_CHILDREN = (f: SchemaField): boolean =>
  Array.isArray(f.fields) && f.fields.length > 0

/**
 * Build HTML for a single node (recursive). Works with any depth of nesting.
 * pathPrefix is the path from root to this node (e.g. ['client', 'name']).
 */
function renderNode(field: SchemaField, depth: number, pathPrefix: string[]): string {
  const hasChildren = HAS_CHILDREN(field)
  const path = pathPrefix.concat(field.name)
  const pathAttr = escapeAttr(JSON.stringify(path))
  const depthClass = depth > 0 ? ` schema-tree-node--depth-${Math.min(depth, 5)}` : ''
  const typeClass = `schema-tree-type--${field.type}`

  const toggleHtml = hasChildren
    ? `<button type="button" class="schema-tree-toggle" aria-expanded="false" aria-label="Expand">▶</button>`
    : '<span class="schema-tree-toggle schema-tree-toggle--leaf"></span>'

  const childrenHtml = hasChildren
    ? `<div class="schema-tree-children" hidden>${(field.fields as SchemaField[]).map((f) => renderNode(f, depth + 1, path)).join('')}</div>`
    : ''

  return `
    <div class="schema-tree-node${depthClass}" data-has-children="${hasChildren}">
      <div class="schema-tree-row">
        ${toggleHtml}
        <span class="schema-tree-name">${escapeHtml(field.name)}</span>
        <span class="schema-tree-type ${typeClass}">${escapeHtml(field.type)}</span>
        <span class="schema-tree-value" data-path="${pathAttr}"></span>
      </div>
      ${childrenHtml}
    </div>
  `
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;')
}

/**
 * Build full tree HTML from top-level fields. Generic: supports any nesting.
 */
export function buildSchemaTreeHtml(fields: SchemaField[], pathPrefix: string[] = []): string {
  const nodes = fields.map((f) => renderNode(f, 0, pathPrefix)).join('')
  return `<div class="schema-tree">${nodes}</div>`
}

/**
 * Get a nested value from an object by path (e.g. ['client','name'] -> obj.client?.name).
 * Arrays: path with number indexes supported; otherwise returns [Array] for arrays.
 */
function getNestedValue(obj: unknown, path: string[]): unknown {
  if (path.length === 0) return obj
  let current: unknown = obj
  for (const key of path) {
    if (current == null) return undefined
    const num = Number(key)
    if (Array.isArray(current) && !Number.isNaN(num) && num >= 0) {
      current = current[num]
    } else if (typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return current
}

function formatFetchedValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.length === 0 ? '[ ]' : `[${value.length} items]`
  if (typeof value === 'object') return '[Object]'
  return String(value)
}

const MAX_POPOVER_ITEMS = 50

function formatInlineValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return `[${v.length} items]`
  if (typeof v === 'object') return '{…}'
  return String(v)
}

/**
 * Build HTML for the list/object popover so it displays well in the small popup.
 */
function buildPopoverContentHtml(value: unknown): string {
  if (value == null) return '<p class="schema-popover-empty">Empty</p>'
  if (Array.isArray(value)) {
    if (value.length === 0) return '<p class="schema-popover-empty">No items</p>'
    const show = value.slice(0, MAX_POPOVER_ITEMS)
    const itemsHtml = show
      .map((item, i) => {
        if (item != null && typeof item === 'object' && !Array.isArray(item)) {
          const rows = Object.entries(item as Record<string, unknown>)
            .slice(0, 12)
            .map(
              ([k, v]) =>
                `<span class="schema-popover-key">${escapeHtml(k)}</span>: <span class="schema-popover-val">${escapeHtml(formatInlineValue(v))}</span>`
            )
          return `<div class="schema-popover-item"><div class="schema-popover-item-index">${i}</div><div class="schema-popover-item-body">${rows.join('<br/>')}</div></div>`
        }
        return `<div class="schema-popover-item schema-popover-item--single"><span class="schema-popover-item-index">${i}</span> ${escapeHtml(formatInlineValue(item))}</div>`
      })
      .join('')
    const more = value.length > MAX_POPOVER_ITEMS ? `<p class="schema-popover-more">… ${value.length - MAX_POPOVER_ITEMS} more items</p>` : ''
    return `<div class="schema-popover-header">${value.length} item${value.length === 1 ? '' : 's'}</div><div class="schema-popover-list">${itemsHtml}${more}</div>`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_POPOVER_ITEMS)
    if (entries.length === 0) return '<p class="schema-popover-empty">Empty object</p>'
    const rows = entries
      .map(
        ([k, v]) =>
          `<div class="schema-popover-row"><span class="schema-popover-key">${escapeHtml(k)}</span><span class="schema-popover-val">${escapeHtml(formatInlineValue(v))}</span></div>`
      )
      .join('')
    const more =
      Object.keys(value as Record<string, unknown>).length > MAX_POPOVER_ITEMS
        ? `<p class="schema-popover-more">… more keys</p>`
        : ''
    return `<div class="schema-popover-header">Object</div><div class="schema-popover-rows">${rows}${more}</div>`
  }
  return `<p class="schema-popover-scalar">${escapeHtml(String(value))}</p>`
}

/** Plain-text fallback for formatValueForListPopover (kept for any other use). */
export function formatValueForListPopover(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) {
    if (value.length === 0) return '[ empty ]'
    const show = value.slice(0, MAX_POPOVER_ITEMS)
    const lines = show.map((item, i) => `[${i}] ${formatInlineValue(item)}`)
    if (value.length > MAX_POPOVER_ITEMS) lines.push(`… ${value.length - MAX_POPOVER_ITEMS} more items`)
    return lines.join('\n')
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '{ empty }'
    const show = entries.slice(0, MAX_POPOVER_ITEMS)
    const lines = show.map(([k, v]) => `${k}: ${formatInlineValue(v)}`)
    if (entries.length > MAX_POPOVER_ITEMS) lines.push(`… ${entries.length - MAX_POPOVER_ITEMS} more keys`)
    return lines.join('\n')
  }
  return String(value)
}

/**
 * Fill all .schema-tree-value cells in the container with values from the given data object.
 * Each cell has data-path (JSON array of path segments); value is read from data and displayed.
 * Arrays and objects get a "View" control and store raw value for popover (truncated if large).
 */
export function fillSchemaFetchedValues(container: HTMLElement, data: Record<string, unknown>): void {
  container.querySelectorAll<HTMLElement>('.schema-tree-value[data-path]').forEach((el) => {
    const pathJson = el.getAttribute('data-path')
    if (!pathJson) return
    let path: string[]
    try {
      path = JSON.parse(pathJson) as string[]
    } catch {
      el.textContent = ''
      return
    }
    const value = getNestedValue(data, path)
    const isExpandable = Array.isArray(value) || (value !== null && typeof value === 'object')
    el.textContent = ''
    el.classList.remove('schema-tree-value--expandable')
    el.removeAttribute('data-raw-value')
    el.querySelector('.schema-tree-value-expand')?.remove()

    const label = document.createTextNode(formatFetchedValue(value))
    el.appendChild(label)
    if (isExpandable) {
      el.classList.add('schema-tree-value--expandable')
      el.dataset.rawValue = JSON.stringify(value)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'schema-tree-value-expand'
      btn.textContent = 'View'
      btn.setAttribute('aria-label', 'View list or object')
      el.appendChild(btn)
    }
  })
}

/**
 * Attach listeners so "View" on array/object cells opens the given popover with formatted content.
 */
export function attachSchemaValueExpandListeners(container: HTMLElement, popoverEl: HTMLElement): void {
  const show = (el: HTMLElement) => {
    const raw = el.dataset.rawValue
    if (!raw) return
    let value: unknown
    try {
      value = JSON.parse(raw) as unknown
    } catch {
      popoverEl.textContent = 'Unable to parse value.'
      popoverEl.hidden = false
      positionPopover(popoverEl, el)
      return
    }
    const wrap = document.createElement('div')
    wrap.className = 'schema-tree-popover-content'
    wrap.innerHTML = buildPopoverContentHtml(value)
    popoverEl.textContent = ''
    popoverEl.appendChild(wrap)
    popoverEl.hidden = false
    positionPopover(popoverEl, el)
  }

  const hide = () => {
    popoverEl.hidden = true
  }

  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const expandBtn = target.closest('.schema-tree-value-expand')
    const valueCell = target.closest('.schema-tree-value--expandable') as HTMLElement | null
    if (expandBtn && valueCell) {
      e.preventDefault()
      show(valueCell)
    }
  })

  document.addEventListener('click', (e) => {
    if (popoverEl.hidden) return
    const p = popoverEl as HTMLElement
    if (!p.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('.schema-tree-value--expandable')) hide()
  })
}

function positionPopover(popover: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect()
  popover.style.left = `${rect.left}px`
  popover.style.top = `${rect.bottom + 6}px`
  requestAnimationFrame(() => {
    const pr = popover.getBoundingClientRect()
    let left = rect.left
    let top = rect.bottom + 6
    if (left + pr.width > window.innerWidth - 8) left = window.innerWidth - pr.width - 8
    if (left < 8) left = 8
    if (top + pr.height > window.innerHeight - 8) top = Math.max(8, rect.top - pr.height - 6)
    if (top < 8) top = 8
    popover.style.left = `${left}px`
    popover.style.top = `${top}px`
  })
}

/**
 * Attach expand/collapse listeners to a tree container.
 */
export function attachSchemaTreeListeners(container: HTMLElement): void {
  container.querySelectorAll('.schema-tree-toggle:not(.schema-tree-toggle--leaf)').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = (btn as HTMLElement).closest('.schema-tree-node')
      const children = row?.querySelector('.schema-tree-children')
      if (!children) return
      const isExpanded = (btn as HTMLElement).getAttribute('aria-expanded') === 'true'
      const el = btn as HTMLElement
      if (isExpanded) {
        children.setAttribute('hidden', '')
        el.setAttribute('aria-expanded', 'false')
        el.textContent = '▶'
      } else {
        children.removeAttribute('hidden')
        el.setAttribute('aria-expanded', 'true')
        el.textContent = '▼'
      }
    })
  })
}
