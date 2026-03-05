import type { SchemaField } from './types'
import { escapeHtml } from './utils'

const HAS_CHILDREN = (f: SchemaField): boolean =>
  Array.isArray(f.fields) && f.fields.length > 0

/**
 * Build HTML for a single node (recursive). Works with any depth of nesting.
 */
function renderNode(field: SchemaField, depth: number): string {
  const hasChildren = HAS_CHILDREN(field)
  const depthClass = depth > 0 ? ` schema-tree-node--depth-${Math.min(depth, 5)}` : ''
  const typeClass = `schema-tree-type--${field.type}`

  const toggleHtml = hasChildren
    ? `<button type="button" class="schema-tree-toggle" aria-expanded="false" aria-label="Expand">▶</button>`
    : '<span class="schema-tree-toggle schema-tree-toggle--leaf"></span>'

  const childrenHtml = hasChildren
    ? `<div class="schema-tree-children" hidden>${(field.fields as SchemaField[]).map((f) => renderNode(f, depth + 1)).join('')}</div>`
    : ''

  return `
    <div class="schema-tree-node${depthClass}" data-has-children="${hasChildren}">
      <div class="schema-tree-row">
        ${toggleHtml}
        <span class="schema-tree-name">${escapeHtml(field.name)}</span>
        <span class="schema-tree-type ${typeClass}">${escapeHtml(field.type)}</span>
      </div>
      ${childrenHtml}
    </div>
  `
}

/**
 * Build full tree HTML from top-level fields. Generic: supports any nesting.
 */
export function buildSchemaTreeHtml(fields: SchemaField[]): string {
  const nodes = fields.map((f) => renderNode(f, 0)).join('')
  return `<div class="schema-tree">${nodes}</div>`
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
